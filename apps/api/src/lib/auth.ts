import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";

export const nonceMessage = (nonce: string) => `RevivePass nonce: ${nonce}`;

export const verifyWalletSignature = (wallet: string, nonce: string, signatureBase58: string) => {
  try {
    const publicKeyBytes = new PublicKey(wallet).toBytes();
    const signature = bs58.decode(signatureBase58);
    const message = Buffer.from(nonceMessage(nonce));
    return nacl.sign.detached.verify(message, signature, publicKeyBytes);
  } catch {
    return false;
  }
};