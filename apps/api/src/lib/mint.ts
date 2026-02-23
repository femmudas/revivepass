import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createSignerFromKeypair,
  generateSigner,
  percentAmount,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { createNft, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { env } from "../config.js";

type MintInput = {
  ownerWallet: string;
  uri: string;
  name: string;
  symbol: string;
};

const umi = createUmi(env.SOLANA_RPC_URL).use(mplTokenMetadata());
const loadAuthority = () => {
  try {
    const secret = Uint8Array.from(JSON.parse(env.PRIVATE_KEY) as number[]);
    return umi.eddsa.createKeypairFromSecretKey(secret);
  } catch {
    return umi.eddsa.generateKeypair();
  }
};
const authority = loadAuthority();
const authoritySigner = createSignerFromKeypair(umi, authority);
umi.use(signerIdentity(authoritySigner));

export const mintRevivalPass = async ({ ownerWallet, uri, name, symbol }: MintInput) => {
  const mint = generateSigner(umi);

  const result = await createNft(umi, {
    mint,
    name,
    symbol,
    uri,
    sellerFeeBasisPoints: percentAmount(0),
    tokenOwner: fromWeb3JsPublicKey(new PublicKey(ownerWallet)),
    isCollection: false,
  }).sendAndConfirm(umi);

  return {
    mintAddress: mint.publicKey.toString(),
    txSignature: bs58.encode(result.signature),
  };
};
