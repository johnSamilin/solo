# Makefile for solo-search (local-only semantic search CLI)
#
# Builds a Linux/amd64 binary suitable for running on Ubuntu, even when
# developing on macOS. Because this project uses cgo (both modernc.org/sqlite
# is pure Go, but github.com/yalue/onnxruntime_go uses cgo to dlopen the
# onnxruntime shared library), cross-compiling from macOS requires either a
# Linux cross-compiler toolchain or building inside a Linux Docker container.
# The `build-linux-docker` target does the latter, requiring only Docker.

BINARY_NAME := solo-search
MODULE      := github.com/solo-notes/semantic-search
DIST_DIR    := dist
GO_VERSION  := 1.23

.PHONY: build build-linux build-linux-docker test vet tidy clean

## build: build a binary for the current host platform (for local testing).
build:
	CGO_ENABLED=1 go build -o $(DIST_DIR)/$(BINARY_NAME) ./cmd/solo-search

## build-linux: cross-compile for linux/amd64 using the local Go toolchain.
## Requires a linux/amd64 C cross-compiler to be available (e.g. via
## `CC=x86_64-linux-gnu-gcc`), since cgo is enabled. On most macOS dev
## machines this will fail without additional setup; prefer
## `build-linux-docker` in that case.
build-linux:
	GOOS=linux GOARCH=amd64 CGO_ENABLED=1 go build -o $(DIST_DIR)/linux-amd64/$(BINARY_NAME) ./cmd/solo-search

## build-linux-docker: cross-compile for linux/amd64 inside a Linux Docker
## container, avoiding any need for a local cross-compiler toolchain.
build-linux-docker:
	mkdir -p $(DIST_DIR)/linux-amd64
	docker run --rm \
		-v $(CURDIR):/src \
		-w /src \
		golang:$(GO_VERSION)-bookworm \
		bash -c "apt-get update -qq && apt-get install -y -qq build-essential >/dev/null && \
			CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -o $(DIST_DIR)/linux-amd64/$(BINARY_NAME) ./cmd/solo-search"

## test: run all unit tests.
test:
	go test ./...

## vet: run go vet across the module.
vet:
	go vet ./...

## tidy: run go mod tidy.
tidy:
	go mod tidy

## clean: remove build artifacts.
clean:
	rm -rf $(DIST_DIR)
