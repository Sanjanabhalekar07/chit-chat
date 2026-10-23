import DirectMessagesPage from "../components/direct-messages-page";
import PageFrame from "../components/page-frame";
import SessionGate from "../components/session-gate";

export default function DirectMessageDirectoryRoute() {
  return (
    <SessionGate>
      <PageFrame>
        <DirectMessagesPage />
      </PageFrame>
    </SessionGate>
  );
}
