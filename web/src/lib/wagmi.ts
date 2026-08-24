import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { celoMainnetChain, celoSepoliaChain } from "./chain";

export const wagmiConfig = createConfig({
  chains: [celoSepoliaChain, celoMainnetChain],
  connectors: [injected()],
  transports: {
    [celoSepoliaChain.id]: http(),
    [celoMainnetChain.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
