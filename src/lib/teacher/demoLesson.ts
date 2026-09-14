import type { TeacherCommandEvent } from "@/types/teacher";

const turnId = "demo-photosynthesis";

export const PHOTOSYNTHESIS_DEMO: TeacherCommandEvent[] = [
  {
    eventId: -1001,
    command: {
      turnId,
      sequence: 1,
      animation: "progressive",
      operations: [
        {
          type: "add_text",
          elementId: "demo-title",
          x: 360,
          y: 36,
          text: "Photosynthesis",
          color: "white",
          fontSize: 38,
        },
        {
          type: "add_line",
          elementId: "demo-title-line",
          start: { x: 350, y: 92 },
          end: { x: 690, y: 92 },
          color: "cyan",
        },
      ],
    },
  },
  {
    eventId: -1002,
    command: {
      turnId,
      sequence: 2,
      animation: "progressive",
      operations: [
        {
          type: "add_rectangle",
          elementId: "demo-sunlight-box",
          x: 54,
          y: 140,
          width: 190,
          height: 76,
          color: "amber",
          label: "☀  Sunlight",
        },
        {
          type: "add_rectangle",
          elementId: "demo-water-box",
          x: 62,
          y: 264,
          width: 150,
          height: 72,
          color: "blue",
          label: "Water",
        },
        {
          type: "add_rectangle",
          elementId: "demo-co2-box",
          x: 62,
          y: 382,
          width: 150,
          height: 72,
          color: "cyan",
          label: "CO₂",
        },
      ],
    },
  },
  {
    eventId: -1003,
    command: {
      turnId,
      sequence: 3,
      animation: "progressive",
      operations: [
        {
          type: "add_ellipse",
          elementId: "demo-leaf",
          x: 360,
          y: 190,
          width: 260,
          height: 230,
          color: "green",
          label: "Photosynthesis\n(in chloroplasts)",
        },
        {
          type: "add_line",
          elementId: "demo-leaf-stem",
          start: { x: 475, y: 385 },
          end: { x: 420, y: 500 },
          color: "green",
        },
      ],
    },
  },
  {
    eventId: -1004,
    command: {
      turnId,
      sequence: 4,
      animation: "progressive",
      operations: [
        {
          type: "add_arrow",
          elementId: "demo-sunlight-arrow",
          start: { x: 252, y: 176 },
          end: { x: 352, y: 235 },
          color: "amber",
        },
        {
          type: "add_arrow",
          elementId: "demo-water-arrow",
          start: { x: 220, y: 300 },
          end: { x: 350, y: 300 },
          color: "white",
        },
        {
          type: "add_arrow",
          elementId: "demo-co2-arrow",
          start: { x: 220, y: 418 },
          end: { x: 356, y: 362 },
          color: "white",
        },
      ],
    },
  },
  {
    eventId: -1005,
    command: {
      turnId,
      sequence: 5,
      animation: "progressive",
      operations: [
        {
          type: "add_rectangle",
          elementId: "demo-glucose-box",
          x: 760,
          y: 160,
          width: 210,
          height: 84,
          color: "green",
          label: "Glucose",
        },
        {
          type: "add_rectangle",
          elementId: "demo-o2-box",
          x: 790,
          y: 300,
          width: 126,
          height: 72,
          color: "green",
          label: "O₂",
        },
      ],
    },
  },
  {
    eventId: -1006,
    command: {
      turnId,
      sequence: 6,
      animation: "progressive",
      operations: [
        {
          type: "add_arrow",
          elementId: "demo-glucose-arrow",
          start: { x: 620, y: 246 },
          end: { x: 748, y: 202 },
          color: "green",
        },
        {
          type: "add_arrow",
          elementId: "demo-o2-arrow",
          start: { x: 624, y: 320 },
          end: { x: 780, y: 334 },
          color: "green",
        },
      ],
    },
  },
  {
    eventId: -1007,
    command: {
      turnId,
      sequence: 7,
      animation: "progressive",
      operations: [
        {
          type: "add_text",
          elementId: "demo-energy-note",
          x: 665,
          y: 430,
          text: "Energy becomes\nstored food",
          color: "white",
          fontSize: 24,
        },
        {
          type: "add_line",
          elementId: "demo-energy-line",
          start: { x: 676, y: 496 },
          end: { x: 846, y: 496 },
          color: "white",
        },
        {
          type: "focus_area",
          x: 30,
          y: 20,
          width: 990,
          height: 520,
        },
      ],
    },
  },
];
