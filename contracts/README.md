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
2. Deploy the suite to Celo Sepolia:
```bash
make deploy-celo-sepolia
```
The current verified deployment is Core `0x111004038F8e918a02CD760E2E2630E0C9E789d6`, Factory `0xB337fC04B8A146c93bCC7b57229Cc8cb18c03fd6`, and Circle implementation `0x8beAfBe2dA703A8ff869C8aB57863bDEA5AD82bf`, deployed at block `34271637`. Deployment artifacts are stored under `broadcast/Deploy.s.sol/11142220/`. Copy the Core and Factory addresses plus the deployment block into `web/.env.local`; the Make target does not write application environment files.

The source-verified Celo mainnet deployment uses the same three addresses. It started at block `76480601` and completed at block `76480602`; its artifacts are stored under `broadcast/Deploy.s.sol/42220/`.

## Verification

To verify the contract bytecode on block explorers:
```bash
make verify-celo-sepolia
```
