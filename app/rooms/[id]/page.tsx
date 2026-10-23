import { Suspense } from "react";
import PageFrame from "../../components/page-frame";
import SessionGate from "../../components/session-gate";
import SingleChatPage from "../../components/single-chat-page";

type SingleRoomPageProps = {
  params: Promise<{ id: string }>;
};

export default function SingleRoomPage({ params }: SingleRoomPageProps) {
  return (
    <Suspense
      fallback={
        <main className="loading-screen">
          <span className="brand-mark">✳</span>
        </main>
      }
    >
      <RoomContent params={params} />
    </Suspense>
  );
}

async function RoomContent({ params }: SingleRoomPageProps) {
  const { id } = await params;
  const roomId = Number(id);

  if (!Number.isInteger(roomId) || roomId <= 0) {
    return (
      <SessionGate>
        <PageFrame>
          <p className="notice-bar">Room not found.</p>
        </PageFrame>
      </SessionGate>
    );
  }

  return (
    <SessionGate>
      <PageFrame>
        <SingleChatPage roomId={roomId} />
      </PageFrame>
    </SessionGate>
  );
}
