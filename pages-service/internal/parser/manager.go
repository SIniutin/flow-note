package parser

import (
	"bufio"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"
	"time"
)

type ParsedPageDTO struct {
	Title    string       `json:"title"`
	PageRefs []PageRefDTO `json:"page_refs"`
	// TableRefs []string     `json:"table_refs"`
	Mentions []MentionDTO `json:"mentions"`
}

type BlockDTO struct {
	BlockID string            `json:"block_id"`
	Type    string            `json:"type"`
	Text    string            `json:"text,omitempty"`
	Attrs   map[string]string `json:"attrs,omitempty"`
}

type PageRefDTO struct {
	TargetPageID string `json:"target_page_id"`
}

type MentionDTO struct {
	SourceBlockID string `json:"source_block_id"`
	User_ID       string `json:"id,omitempty"`
	Label         string `json:"label"`
	Kind          string `json:"kind,omitempty"`
}

type request struct {
	ID          string `json:"id"`
	SnapshotB64 string `json:"snapshot_b64"`
}

type response struct {
	ID     string         `json:"id"`
	OK     bool           `json:"ok"`
	Result *ParsedPageDTO `json:"result,omitempty"`
	Error  string         `json:"error,omitempty"`
}

type pendingCall struct {
	ch chan response
}

type NodeParser struct {
	mu      sync.Mutex
	cmd     *exec.Cmd
	stdin   io.WriteCloser
	pending map[string]*pendingCall
	closed  bool
	reqSeq  uint64
	exitCh  chan error
}

func NewNodeParser(ctx context.Context, nodePath string, scriptPath string) (*NodeParser, error) {
	// Лучше явный путь ./parser.js, а не поиск по текущей директории.
	cmd := exec.CommandContext(ctx, nodePath, scriptPath)

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("stdin pipe: %w", err)
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("stdout pipe: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, fmt.Errorf("stderr pipe: %w", err)
	}

	p := &NodeParser{
		cmd:     cmd,
		stdin:   stdin,
		pending: make(map[string]*pendingCall),
		exitCh:  make(chan error, 1),
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start node parser: %w", err)
	}

	go p.readStdout(stdout)
	go p.readStderr(stderr)
	go p.watchExit()

	return p, nil
}

func (p *NodeParser) ParseSnapshot(ctx context.Context, snapshot []byte) (*ParsedPageDTO, error) {
	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		return nil, errors.New("node parser is closed")
	}
	p.reqSeq++
	reqID := fmt.Sprintf("req-%d", p.reqSeq)
	call := &pendingCall{ch: make(chan response, 1)}
	p.pending[reqID] = call
	p.mu.Unlock()

	req := request{
		ID:          reqID,
		SnapshotB64: base64.StdEncoding.EncodeToString(snapshot),
	}

	payload, err := json.Marshal(req)
	if err != nil {
		p.removePending(reqID)
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	// NDJSON: одна строка = один запрос
	if _, err := p.stdin.Write(append(payload, '\n')); err != nil {
		p.removePending(reqID)
		return nil, fmt.Errorf("write to parser stdin: %w", err)
	}

	select {
	case <-ctx.Done():
		p.removePending(reqID)
		return nil, ctx.Err()

	case resp := <-call.ch:
		if !resp.OK {
			return nil, fmt.Errorf("parser error: %s", resp.Error)
		}
		if resp.Result == nil {
			return nil, errors.New("parser returned empty result")
		}
		return resp.Result, nil
	}
}

// Close:
func (p *NodeParser) Close() error {
	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		return nil
	}
	p.closed = true
	p.mu.Unlock()

	_ = p.stdin.Close()

	select {
	case err := <-p.exitCh:
		return err
	case <-time.After(3 * time.Second):
		_ = p.cmd.Process.Kill()
		return errors.New("node parser killed on close timeout")
	}
}

func (p *NodeParser) readStdout(stdout io.Reader) {
	scanner := bufio.NewScanner(stdout)

	// Увеличим буфер, если DTO большой.
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 10*1024*1024)

	for scanner.Scan() {
		line := scanner.Bytes()

		var resp response
		if err := json.Unmarshal(line, &resp); err != nil {
			fmt.Fprintf(os.Stderr, "[node-parser] bad stdout json: %v; line=%s\n", err, string(line))
			continue
		}

		p.mu.Lock()
		call := p.pending[resp.ID]
		if call != nil {
			delete(p.pending, resp.ID)
		}
		p.mu.Unlock()

		if call != nil {
			call.ch <- resp
		}
	}

	if err := scanner.Err(); err != nil {
		fmt.Fprintf(os.Stderr, "[node-parser] stdout scanner error: %v\n", err)
	}
}

func (p *NodeParser) readStderr(stderr io.Reader) {
	scanner := bufio.NewScanner(stderr)
	for scanner.Scan() {
		fmt.Fprintf(os.Stderr, "[node-parser] %s\n", scanner.Text())
	}
	if err := scanner.Err(); err != nil {
		fmt.Fprintf(os.Stderr, "[node-parser] stderr scanner error: %v\n", err)
	}
}

// watchExit:
func (p *NodeParser) watchExit() {
	err := p.cmd.Wait()
	p.exitCh <- err

	p.mu.Lock()
	defer p.mu.Unlock()

	if !p.closed {
		p.closed = true
		for id, call := range p.pending {
			call.ch <- response{
				ID:    id,
				OK:    false,
				Error: fmt.Sprintf("parser exited: %v", err),
			}
			delete(p.pending, id)
		}
	}
}

func (p *NodeParser) removePending(id string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	delete(p.pending, id)
}
