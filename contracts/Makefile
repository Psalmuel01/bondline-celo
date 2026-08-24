include .env
export

.PHONY: deploy-celo-sepolia deploy-celo-mainnet verify-celo-sepolia verify-celo-mainnet

deploy-celo-sepolia:
	forge script script/Deploy.s.sol --rpc-url celo_sepolia --broadcast

deploy-celo-mainnet:
	forge script script/Deploy.s.sol --rpc-url celo_mainnet --broadcast

verify-celo-sepolia:
	@CHAIN_ID=11142220 RPC_ALIAS=celo_sepolia node scripts/verify-deployment.cjs

verify-celo-mainnet:
	@CHAIN_ID=42220 RPC_ALIAS=celo_mainnet node scripts/verify-deployment.cjs
