import { useTheme } from "../../composables/useTheme";
import { Settings } from "../../components/settings";

export default function App() {
    useTheme();
    return <Settings />;
}
