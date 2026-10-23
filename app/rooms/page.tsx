import PageFrame from "../components/page-frame";
import RoomsPage from "../components/rooms-page";
import SessionGate from "../components/session-gate";

export default function RoomListPage() {
  return (
    <SessionGate>
      <PageFrame>
        <RoomsPage />
      </PageFrame>
    </SessionGate>
  );
}
