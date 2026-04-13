package domain

import "testing"

func TestAnchorHashStable(t *testing.T) {
	start, end := 1, 2
	anchor := Anchor{Kind: "text_range", BlockID: "block-1", StartOffset: &start, EndOffset: &end}
	hash1, err := anchor.Hash()
	if err != nil {
		t.Fatal(err)
	}
	hash2, err := anchor.Hash()
	if err != nil {
		t.Fatal(err)
	}
	if hash1 != hash2 {
		t.Fatalf("expected stable hash, got %s != %s", hash1, hash2)
	}
}
