"use client";

import { useCallback, useState } from "react";
import { useTorque } from "@torque-labs/react";

type RewardInput = {
  walletAddress: string;
  migrationSlug: string;
};

type RewardResult = {
  ok: boolean;
  message: string;
  source: "torque" | "fallback";
};

type TorqueLike = {
  authenticate?: () => Promise<unknown>;
  torque?: {
    offers?: {
      startOffer?: (offerId: string, referrer?: string) => Promise<unknown>;
      claimOffer?: (offerId: string) => Promise<unknown>;
    };
  };
  award?: (payload: unknown) => Promise<unknown>;
  rewards?: {
    award?: (payload: unknown) => Promise<unknown>;
  };
  campaigns?: {
    award?: (payload: unknown) => Promise<unknown>;
  };
};

export const useReward = () => {
  const torque = useTorque() as TorqueLike | null;
  const [awarding, setAwarding] = useState(false);
  const offerId = (process.env.NEXT_PUBLIC_TORQUE_OFFER_ID ?? "").trim();

  const awardMigrationReward = useCallback(
    async ({ walletAddress, migrationSlug }: RewardInput): Promise<RewardResult> => {
      setAwarding(true);
      try {
        if (!torque) {
          return {
            ok: false,
            source: "fallback",
            message: "Torque SDK is unavailable in this session.",
          };
        }

        if (torque.authenticate) {
          await torque.authenticate();
        }

        const payload = {
          walletAddress,
          campaignKey: "revivepass-migration",
          action: "migration_completed",
          metadata: {
            migrationSlug,
          },
        };

        if (torque.award) {
          await torque.award(payload);
          return { ok: true, message: "Torque reward granted.", source: "torque" };
        }

        if (torque.rewards?.award) {
          await torque.rewards.award(payload);
          return { ok: true, message: "Torque reward granted.", source: "torque" };
        }

        if (torque.campaigns?.award) {
          await torque.campaigns.award(payload);
          return { ok: true, message: "Torque reward granted.", source: "torque" };
        }

        if (offerId && torque.torque?.offers?.startOffer) {
          await torque.torque.offers.startOffer(offerId, migrationSlug);
          return { ok: true, message: "Torque campaign started for this wallet.", source: "torque" };
        }

        if (offerId && torque.torque?.offers?.claimOffer) {
          await torque.torque.offers.claimOffer(offerId);
          return { ok: true, message: "Torque campaign claimed for this wallet.", source: "torque" };
        }

        return {
          ok: true,
          source: "fallback",
          message:
            "Torque authenticated. Set NEXT_PUBLIC_TORQUE_OFFER_ID to execute a campaign reward action.",
        };
      } catch (error) {
        return {
          ok: false,
          source: "fallback",
          message: (error as Error).message || "Torque reward request failed.",
        };
      } finally {
        setAwarding(false);
      }
    },
    [torque]
  );

  return { awarding, awardMigrationReward };
};
