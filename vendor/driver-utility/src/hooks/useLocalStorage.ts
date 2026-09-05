import { useState, useCallback, useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadValue = async () => {
      setIsLoaded(false);

      try {
        const { value } = await Preferences.get({ key });

        if (value !== null) {
          try {
            const parsed = JSON.parse(value) as T;

            if (isMounted) {
              setStoredValue(parsed);
              setIsLoaded(true);
            }

            return;
          } catch (error) {
            console.error(`Preferences corrotto per chiave "${key}" → reset`, error);

            const serializedInitial = JSON.stringify(initialValue);

            await Preferences.set({
              key,
              value: serializedInitial,
            });

            try {
              if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, serializedInitial);
              }
            } catch (localError) {
              console.error('Errore localStorage durante reset', localError);
            }

            if (isMounted) {
              setStoredValue(initialValue);
              setIsLoaded(true);
            }

            return;
          }
        }

        if (typeof window !== 'undefined') {
          const localValue = window.localStorage.getItem(key);

          if (localValue !== null) {
            try {
              const parsed = JSON.parse(localValue) as T;

              await Preferences.set({
                key,
                value: JSON.stringify(parsed),
              });

              if (isMounted) {
                setStoredValue(parsed);
                setIsLoaded(true);
              }

              return;
            } catch (error) {
              console.error(`localStorage corrotto per chiave "${key}" → reset`, error);
              window.localStorage.removeItem(key);
            }
          }
        }

        const serializedInitial = JSON.stringify(initialValue);

        await Preferences.set({
          key,
          value: serializedInitial,
        });

        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, serializedInitial);
          }
        } catch (error) {
          console.error('Errore localStorage salvataggio iniziale', error);
        }

        if (isMounted) {
          setStoredValue(initialValue);
          setIsLoaded(true);
        }
      } catch (error) {
        console.error(`Errore load "${key}"`, error);

        if (isMounted) {
          setStoredValue(initialValue);
          setIsLoaded(true);
        }
      }
    };

    loadValue();

    return () => {
      isMounted = false;
    };
  }, [key]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const newValue = value instanceof Function ? value(prev) : value;

        try {
          const serialized = JSON.stringify(newValue);

          Preferences.set({ key, value: serialized }).catch((error) => {
            console.error(`Errore Preferences "${key}"`, error);
          });

          try {
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(key, serialized);
            }
          } catch (error) {
            console.error(`Errore localStorage "${key}"`, error);
          }
        } catch (error) {
          console.error(`Errore serializzazione "${key}"`, error);
        }

        return newValue;
      });
    },
    [key]
  );

  return [storedValue, setValue, isLoaded];
}