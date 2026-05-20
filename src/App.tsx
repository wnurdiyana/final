import { Route, Switch } from "wouter";
import Home from "./pages/Home";
import Sponsorship from "./pages/Sponsorship";
import Organizer from "./pages/Organizer";
import Programme from "./pages/Programme";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/sponsorship" component={Sponsorship} />
      <Route path="/organizer" component={Organizer} />
      <Route path="/programme" component={Programme} />
      <Route path="/admin" component={Admin} />
      <Route>
        <div className="min-h-screen flex items-center justify-center text-foreground">
          <div className="text-center">
            <div className="text-5xl font-extrabold gradient-text mb-2">404</div>
            <div className="text-muted-foreground">Page not found.</div>
          </div>
        </div>
      </Route>
    </Switch>
  );
}
