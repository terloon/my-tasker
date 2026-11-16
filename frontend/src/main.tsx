import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StyledEngineProvider } from "@mui/material/styles";
import App from "./App";
import "./styles/base.css";
import "./styles/app.css";

const client = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 3000, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});
const router = createBrowserRouter([{ path: "*", element: <App /> }]);
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StyledEngineProvider injectFirst>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StyledEngineProvider>
  </React.StrictMode>,
);
