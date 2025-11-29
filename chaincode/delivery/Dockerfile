# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /go/src/chaincode

# Copy go mod files first for better caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY *.go ./

# Build the chaincode
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o chaincode .

# Runtime stage
FROM alpine:3.18

WORKDIR /chaincode

# Copy the binary from build stage
COPY --from=builder /go/src/chaincode/chaincode .

# Set default environment variables
ENV CHAINCODE_SERVER_ADDRESS=0.0.0.0:9999
ENV CHAINCODE_ID=""

# Expose the chaincode server port
EXPOSE 9999

# Run the chaincode
CMD ["./chaincode"]
