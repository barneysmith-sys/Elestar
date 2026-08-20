import Board from "../../web/src/pages/Board";
import { EngineMark } from "../EngineMark";

export const dynamic = "force-dynamic";

export default function WallPage() {
  return (
    <>
      <EngineMark />
      <Board />
    </>
  );
}
