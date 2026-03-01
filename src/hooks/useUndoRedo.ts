import { useState, useCallback } from 'react';

export function useUndoRedo<T>(initialState: T) {
  const [present, setPresent] = useState<T>(initialState);
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);

  const undo = useCallback(() => {
    if (past.length === 0) return;

    setPresent((currentPresent) => {
      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);

      setFuture((prevFuture) => [currentPresent, ...prevFuture]);
      setPast(newPast);
      return previous;
    });
  }, [past]);

  const redo = useCallback(() => {
    if (future.length === 0) return;

    setPresent((currentPresent) => {
      const next = future[0];
      const newFuture = future.slice(1);

      setPast((prevPast) => [...prevPast, currentPresent]);
      setFuture(newFuture);
      return next;
    });
  }, [future]);

  const pushToHistory = useCallback(() => {
    setPast((prevPast) => {
      const newPast = [...prevPast, present];
      if (newPast.length > 50) return newPast.slice(1);
      return newPast;
    });
    setFuture([]);
  }, [present]);

  const updateState = useCallback((updater: T | ((prev: T) => T)) => {
    setPresent(updater);
  }, []);

  return {
    state: present,
    setState: updateState,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    pushToHistory
  };
}
