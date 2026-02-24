import { Card, CardDescription, CardTitle } from "@/components/ui/card";

const checklist = [
  {
    title: "Snapshot creation guide",
    body: "Export holders from your source chain and map each entry to target Solana wallets in CSV format.",
  },
  {
    title: "Solana wallet onboarding",
    body: "Guide users through wallet installation, seed safety, and claim signature verification.",
  },
  {
    title: "NFT access pass distribution",
    body: "Use RevivePass claim links so each eligible wallet can mint one authenticated migration pass and receive rewards.",
  },
  {
    title: "Community revival dashboard",
    body: "Track conversion progress, reward completion, and social activity with migration analytics.",
  },
  {
    title: "Torque and Tapestry activation",
    body: "Award loyalty points through Torque and publish migration announcements through Tapestry Social.",
  },
];

export default function ChecklistPage() {
  return (
    <div className="space-y-5 py-6">
      <h1 className="text-3xl font-bold">Migration Checklist</h1>
      <p className="max-w-2xl text-foreground/75">
        Follow this sequence to move your community onto Solana with confidence and verifiable participation.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {checklist.map((item) => (
          <Card key={item.title} className="space-y-2">
            <CardTitle>{item.title}</CardTitle>
            <CardDescription>{item.body}</CardDescription>
          </Card>
        ))}
      </div>

    </div>
  );
}
