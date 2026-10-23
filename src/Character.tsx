import { useState } from "react";

// User-supplied originals are served locally; no third-party image requests.
const characters = {
  chiikawa: { file: "chiikawa.png", label: "치이카와" },
  hachiware: { file: "hachiware.jpg", label: "하치와레" },
  usagi: { file: "usagi.jpg", label: "우사기" },
  "chiikawa-rest": { file: "chiikawa-rest.jpg", label: "쉬고 있는 치이카와" },
  friends: { file: "friends.jpg", label: "치이카와와 하치와레" },
} as const;

export function Character({
  name = "chiikawa",
  size = 110,
}: {
  name?: keyof typeof characters;
  size?: number;
}) {
  const [failedFile, setFailedFile] = useState<string>();
  const character = characters[name];
  return (
    <div className={`character ${name}`} style={{ width: size, height: size }}>
      <div className="character-frame">
        {failedFile !== character.file ? (
          <img
            src={`/characters/${character.file}`}
            alt={character.label}
            title={character.label}
            width={size}
            height={size}
            onError={() => setFailedFile(character.file)}
          />
        ) : (
          <span
            className="character-fallback"
            role="img"
            aria-label={`${character.label} 이미지를 불러오지 못했어요`}
          >
            🌱
          </span>
        )}
      </div>
    </div>
  );
}
