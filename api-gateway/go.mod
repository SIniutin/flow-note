module github.com/flow-note/api-gateway

go 1.26.1

replace github.com/flow-note/api-contracts => ../api-contracts

replace github.com/flow-note/common => ../common

require (
	github.com/flow-note/api-contracts v0.0.0-00010101000000-000000000000
	github.com/flow-note/common v0.0.0-00010101000000-000000000000
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.28.0
	google.golang.org/grpc v1.80.0
	google.golang.org/protobuf v1.36.11
)

require (
	github.com/golang-jwt/jwt/v5 v5.3.1 // indirect
	go.uber.org/multierr v1.10.0 // indirect
	go.uber.org/zap v1.27.1
	golang.org/x/crypto v0.50.0 // indirect
	golang.org/x/net v0.52.0 // indirect
	golang.org/x/sys v0.43.0 // indirect
	golang.org/x/text v0.36.0 // indirect
	google.golang.org/genproto/googleapis/api v0.0.0-20260413220744-3e5c5a5a0756 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20260406210006-6f92a3bedf2d // indirect
)
