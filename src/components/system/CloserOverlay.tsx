// The host of the "look closer" views, over the floor. src/closers/host.tsx fills it.
import { registerHost } from "../../closers/host";
import "../../closers/closers.css";

export function CloserOverlay() {
  return <div className="closer" ref={registerHost} />;
}
