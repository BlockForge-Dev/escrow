# Milestone Escrow

An Aptos Move package for milestone-based escrow contracts.

## Project Structure

```text
milestone_escrow/
├── Move.toml                # Package manifest (name, dependencies, addresses)
├── sources/
│   ├── escrow.move          # Main module
│   └── escrow_tests.move    # Test module
├── tests/                   # Test directory
└── README.md
```

## Setup & Compilation

### Configuration

The package address is configured in `Move.toml`:
```toml
[addresses]
escrow_addr = "0x2b2c1988fb1d3688b16d480b7eff6a3d62133a789de1d34f81a5aea7e5fdac05"
```

### Build & Compile

To compile the Move package:

```bash
aptos move compile
```

To run tests:

```bash
aptos move test
```
