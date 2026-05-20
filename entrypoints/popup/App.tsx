import { useTheme } from "../../composables/useTheme";
import { Popup } from "../../components/popup";

export default function App() {
  useTheme();
  return <Popup />;
}
