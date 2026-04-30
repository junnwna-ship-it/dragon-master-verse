import { create } from "zustand";

export type Element = "Wood" | "Water" | "Fire" | "Earth" | "Light" | "Dark";

export interface Dragon {
  id: number;
  name: string;
  element: Element;
  hp: number;
  maxHp: number;
  mp: number;
  atk: number;
  def: number;
}

export type View = "lobby" | "story" | "pvp";

interface GameState {
  dragons: Dragon[];
  view: View;
  setView: (v: View) => void;
}

export const useGameStore = create<GameState>((set) => ({
  dragons: [
    { id: 1, name: "Puri", element: "Wood", hp: 60, maxHp: 60, mp: 50, atk: 40, def: 50 },
    { id: 2, name: "Spike", element: "Water", hp: 50, maxHp: 50, mp: 90, atk: 80, def: 20 },
    { id: 3, name: "Bella", element: "Water", hp: 40, maxHp: 40, mp: 80, atk: 75, def: 35 },
  ],
  view: "lobby",
  setView: (view) => set({ view }),
}));