import { Suspense } from "react";
import PageFrame from "../../components/page-frame";
import SessionGate from "../../components/session-gate";
import SingleChatPage from "../../components/single-chat-page";

type ConversationPageProps = {
  params: Promise<{ username: string }>;
};

export default function ConversationPage({ params }: ConversationPageProps) {
  return (
    <Suspense
      fallback={
        <main className="loading-screen">
          <span className="brand-mark">✳</span>
        </main>
      }
    >
      <ConversationContent params={params} />
    </Suspense>
  );
}

async function ConversationContent({ params }: ConversationPageProps) {
  const { username } = await params;
  return (
    <SessionGate>
      <PageFrame>
        <SingleChatPage username={decodeURIComponent(username)} />
      </PageFrame>
    </SessionGate>
  );
}
