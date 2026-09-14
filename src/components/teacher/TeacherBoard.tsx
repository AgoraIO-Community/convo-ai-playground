"use client";

import "@excalidraw/excalidraw/index.css";

import dynamic from "next/dynamic";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawProps,
} from "@excalidraw/excalidraw/types";
import {
  getFocusedExcalidrawElements,
  toExcalidrawElements,
} from "@/lib/teacher/excalidrawAdapter";
import type { TeacherBoardState } from "@/types/teacher";

const Excalidraw = dynamic<ExcalidrawProps>(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[#07110f] text-sm text-cyan-100/60">
        Preparing the blackboard…
      </div>
    ),
  },
);

export interface TeacherBoardHandle {
  applyState(
    state: TeacherBoardState,
    animation: "progressive" | "instant",
  ): Promise<void>;
  cancelAnimation(): void;
  reset(): void;
}

interface TeacherBoardProps {
  state: TeacherBoardState;
  animation?: "progressive" | "instant";
  active?: boolean;
  className?: string;
}

const STUDENT_OWNER = "student";
const AI_OWNER = "ai";

function ownerOf(element: OrderedExcalidrawElement): unknown {
  return element.customData?.teacherOwner;
}

function asStudentElement(
  element: OrderedExcalidrawElement,
): OrderedExcalidrawElement {
  return {
    ...element,
    customData: {
      ...element.customData,
      teacherOwner: STUDENT_OWNER,
    },
  } as OrderedExcalidrawElement;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

const TeacherBoard = forwardRef<TeacherBoardHandle, TeacherBoardProps>(
  function TeacherBoard(
    { state, animation = "instant", active = true, className = "" },
    forwardedRef,
  ) {
    const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
    const studentElementsRef = useRef(
      new Map<string, OrderedExcalidrawElement>(),
    );
    const expectedAiVersionsRef = useRef(new Map<string, number>());
    const clearBoardRevisionRef = useRef(state.clearBoardRevision);
    const animationTokenRef = useRef(0);
    const applyingSceneRef = useRef(false);
    const latestStateRef = useRef(state);
    latestStateRef.current = state;

    const updateScene = useCallback(
      (aiElements: readonly OrderedExcalidrawElement[]) => {
        const api = apiRef.current;
        if (!api) return;
        const studentElements = [...studentElementsRef.current.values()];
        const studentIds = new Set(studentElements.map((element) => element.id));
        const merged = [
          ...aiElements.filter((element) => !studentIds.has(element.id)),
          ...studentElements,
        ];

        expectedAiVersionsRef.current = new Map(
          aiElements.map((element) => [element.id, element.version]),
        );
        applyingSceneRef.current = true;
        api.updateScene({
          elements: merged,
          appState: {
            // Excalidraw dark mode color-inverts its canvas surface. A pale
            // source color therefore renders as the intended near-black board.
            viewBackgroundColor: "#f8fafc",
            currentItemStrokeColor: "#f8fafc",
            currentItemBackgroundColor: "transparent",
            currentItemFillStyle: "hachure",
            currentItemRoughness: 2,
          },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        window.setTimeout(() => {
          applyingSceneRef.current = false;
        }, 0);
      },
      [],
    );

    const applyState = useCallback(
      async (
        nextState: TeacherBoardState,
        nextAnimation: "progressive" | "instant",
      ) => {
        const api = apiRef.current;
        if (!api) return;
        const token = animationTokenRef.current + 1;
        animationTokenRef.current = token;

        if (nextState.clearBoardRevision !== clearBoardRevisionRef.current) {
          studentElementsRef.current.clear();
          clearBoardRevisionRef.current = nextState.clearBoardRevision;
        }

        const allAiElements = toExcalidrawElements(nextState);
        updateScene(allAiElements);
        if (nextAnimation === "progressive") {
          // Lesson commands already arrive progressively. Applying each command
          // as one atomic scene keeps Excalidraw's bound labels, containers, and
          // fractional indices consistent while preserving the drawn-in rhythm.
          await delay(115);
        }

        if (animationTokenRef.current !== token) return;
        const focusTargets = getFocusedExcalidrawElements(
          allAiElements,
          nextState,
        );
        if (focusTargets.length > 0) {
          api.scrollToContent(focusTargets, {
            fitToViewport: true,
            viewportZoomFactor: 0.84,
            minZoom: 0.35,
            maxZoom: 1.4,
            animate: nextAnimation === "progressive",
            duration: 320,
            canvasOffsets: { top: 56, right: 250, bottom: 36, left: 24 },
          });
        }
      },
      [updateScene],
    );

    const cancelAnimation = useCallback(() => {
      animationTokenRef.current += 1;
    }, []);

    const reset = useCallback(() => {
      cancelAnimation();
      studentElementsRef.current.clear();
      expectedAiVersionsRef.current.clear();
      const api = apiRef.current;
      if (!api) return;
      applyingSceneRef.current = true;
      api.updateScene({
        elements: [],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      api.history.clear();
      window.setTimeout(() => {
        applyingSceneRef.current = false;
      }, 0);
    }, [cancelAnimation]);

    useImperativeHandle(
      forwardedRef,
      () => ({ applyState, cancelAnimation, reset }),
      [applyState, cancelAnimation, reset],
    );

    const handleChange = useCallback(
      (
        elements: readonly OrderedExcalidrawElement[],
        _appState: AppState,
        _files: BinaryFiles,
      ) => {
        if (applyingSceneRef.current) return;
        let shouldTagScene = false;
        const nextStudents = new Map(studentElementsRef.current);

        for (const element of elements) {
          if (element.isDeleted) {
            nextStudents.delete(element.id);
            continue;
          }
          const owner = ownerOf(element);
          const expectedAiVersion = expectedAiVersionsRef.current.get(
            element.id,
          );
          const isUnchangedAi =
            owner === AI_OWNER &&
            expectedAiVersion !== undefined &&
            element.version <= expectedAiVersion;
          if (isUnchangedAi) continue;

          const studentElement = asStudentElement(element);
          nextStudents.set(element.id, studentElement);
          if (owner !== STUDENT_OWNER) shouldTagScene = true;
        }

        studentElementsRef.current = nextStudents;
        if (shouldTagScene) {
          const aiElements = toExcalidrawElements(latestStateRef.current);
          updateScene(aiElements);
        }
      },
      [updateScene],
    );

    const setApi = useCallback(
      (api: ExcalidrawImperativeAPI) => {
        apiRef.current = api;
        window.requestAnimationFrame(() => {
          if (apiRef.current === api) {
            void applyState(latestStateRef.current, "instant");
          }
        });
      },
      [applyState],
    );

    useEffect(() => {
      void applyState(state, animation);
    }, [animation, applyState, state]);

    useEffect(() => {
      if (!active) return;
      apiRef.current?.refresh();
    }, [active]);

    useEffect(() => cancelAnimation, [cancelAnimation]);

    return (
      <div
        className={`teacher-blackboard relative h-full min-h-[360px] w-full overflow-hidden rounded-[22px] border border-cyan-300/25 bg-[#07110f] shadow-[0_24px_80px_rgba(0,0,0,0.42),inset_0_0_60px_rgba(34,211,238,0.035)] ${className}`}
      >
        <div className="pointer-events-none absolute inset-0 z-[2] rounded-[22px] ring-1 ring-inset ring-white/[0.035]" />
        <Excalidraw
          excalidrawAPI={setApi}
          initialData={{
            appState: {
              theme: "dark",
              viewBackgroundColor: "#f8fafc",
              gridSize: 20,
              gridStep: 5,
              gridModeEnabled: true,
              currentItemStrokeColor: "#f8fafc",
              currentItemBackgroundColor: "transparent",
              currentItemFillStyle: "hachure",
              currentItemRoughness: 2,
            },
          }}
          onChange={handleChange}
          theme="dark"
          gridModeEnabled
          zenModeEnabled={false}
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: false,
              clearCanvas: false,
              export: false,
              loadScene: false,
              saveToActiveFile: false,
              saveAsImage: false,
              toggleTheme: false,
            },
            tools: { image: false },
          }}
        />
      </div>
    );
  },
);

TeacherBoard.displayName = "TeacherBoard";

export default TeacherBoard;
