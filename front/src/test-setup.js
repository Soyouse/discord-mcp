// Setup global des tests composants : matchers DOM (@testing-library/jest-dom) + cleanup auto.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());
