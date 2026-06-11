import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Avatar } from "./Avatar.jsx";

describe("Avatar", () => {
  it("avec src → image (alt = name)", () => {
    render(<Avatar src="https://cdn.example/x.png" name="alice" />);
    expect(screen.getByAltText("alice")).toHaveAttribute("src", "https://cdn.example/x.png");
  });

  it("sans src → initiale du nom (fallback, jamais d'img cassée)", () => {
    render(<Avatar src={null} name="waikoz" />);
    expect(screen.getByText("W")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("image en erreur (CDN down / hash périmé) → retombe sur l'initiale", () => {
    render(<Avatar src="https://cdn.example/mort.png" name="bob" />);
    fireEvent.error(screen.getByAltText("bob"));
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("name absent → ?", () => {
    render(<Avatar />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});
