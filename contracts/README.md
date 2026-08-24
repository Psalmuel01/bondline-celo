# Bondline Smart Contracts

Solidity smart contracts implementing the core Bondline logic on Celo.

## Setup & Compilation

Ensure you have Foundry installed. If not, follow instructions at [book.getfoundry.sh](https://book.getfoundry.sh/).

Compile contracts:
```bash
forge build
```

## Running Tests

Execute the unit tests covering the math, clone isolation, voting, and reentrancy protections:
```bash
forge test
```

Generate gas snapshots:
```bash
forge snapshot
```

## Deployment

1. Copy `.env.example` to `.env` and fill out your private key.
2. Deploy the suite to Celo testnet:
```bash
make deploy
```
This runs the Foundry deployment script, extracts the deployed addresses, and automatically writes them to `web/.env.local` for the frontend.

## Verification

To verify the contract bytecode on block explorers:
```bash
make verify
```

Alternatively, use the direct sequence target:
```bash
make deploy-verify
```
