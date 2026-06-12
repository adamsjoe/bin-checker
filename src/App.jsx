import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";

const BIN_DEFINITIONS = [
  {
    key: "general",
    displayName: "General Waste",
    labels: ["general waste", "general"],
    color: "green",
  },
  {
    key: "blue",
    displayName: "Blue-lidded Recycling Bin",
    labels: [
      "blue-lidded recycling bin",
      "blue-lidded recycling",
      "blue recycling",
    ],
    color: "#007bff",
  },
  {
    key: "food",
    displayName: "Food and Garden",
    labels: ["food and garden", "food & garden", "food and garden waste"],
    color: "#8B4513",
  },
  {
    key: "glass",
    displayName: "Glass, Metals, Plastics and Cartons",
    labels: [
      "glass, metals, plastics and cartons",
      "glass, metals, plastics",
      "glass",
    ],
    color: "grey",
  },
];

const ADDRESSES = {
  "golf place":
    "https://www.northlanarkshire.gov.uk/bin-collection-dates/000118048625/48403561",
  "bowhill road":
    "https://www.northlanarkshire.gov.uk/bin-collection-dates/000118177444/48410136",
};

export default function App() {
  const [bins, setBins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [today, setToday] = useState("");
  const [testMode, setTestMode] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState("golf place");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isTestMode = params.get("test") === "true";
    setTestMode(isTestMode);

    let cancelled = false;
    setLoading(true);
    setBins([]);
    setError("");

    const fetchAndParse = async () => {
      try {
        const canonicalMap = BIN_DEFINITIONS.reduce((acc, def) => {
          acc[def.key] = {
            key: def.key,
            displayName: def.displayName,
            color: def.color,
            hasCollectionTodayOrTomorrow: false,
            collectionDay: null,
            nextCollection: null,
          };
          return acc;
        }, {});

        const todayLabel = new Date().toLocaleDateString("en-GB", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        });

        if (isTestMode) {
          BIN_DEFINITIONS.forEach((def) => {
            canonicalMap[def.key].hasCollectionTodayOrTomorrow = true;
            canonicalMap[def.key].collectionDay = "Tomorrow (Test Mode)";
            canonicalMap[def.key].nextCollection = "Tomorrow (Test Mode)";
          });
          if (cancelled) return;
          setToday(todayLabel);
          setBins(BIN_DEFINITIONS.map((d) => canonicalMap[d.key]));
          return;
        }

        const res = await fetch(
          "https://api.allorigins.win/get?url=" +
            encodeURIComponent(ADDRESSES[selectedAddress])
        );
        if (!res.ok) {
          throw new Error(`request failed with status ${res.status}`);
        }
        const { contents: html } = await res.json();
        if (!html) {
          throw new Error("proxy returned no content");
        }
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const containers = Array.from(
          doc.querySelectorAll(".waste-type-container")
        );
        if (containers.length === 0) {
          throw new Error(
            "no bin data found — the council page layout may have changed"
          );
        }

        containers.forEach((container) => {
          const rawBinType = (
            container.querySelector("h3")?.textContent || ""
          ).trim();
          const dateStrings = Array.from(container.querySelectorAll("p")).map(
            (p) => p.textContent.trim()
          );
          const normalized = rawBinType.toLowerCase();

          let matchedDef = BIN_DEFINITIONS.find((def) =>
            def.labels.some((lbl) => normalized.includes(lbl))
          );
          if (!matchedDef) return;

          const key = matchedDef.key;

          const dates = dateStrings
            .map((ds) => new Date(ds))
            .filter((d) => !Number.isNaN(d.getTime()))
            .sort((a, b) => a - b);
          if (dates.length === 0) {
            console.warn(
              `No valid collection dates parsed for "${rawBinType}"`
            );
            return;
          }

          const todayDate = new Date();
          todayDate.setHours(0, 0, 0, 0);
          const tomorrow = new Date(todayDate);
          tomorrow.setDate(tomorrow.getDate() + 1);

          const hasToday = dates.some(
            (d) => d.toDateString() === todayDate.toDateString()
          );
          const hasTomorrow = dates.some(
            (d) => d.toDateString() === tomorrow.toDateString()
          );

          if (hasToday || hasTomorrow) {
            canonicalMap[key].hasCollectionTodayOrTomorrow = true;
            canonicalMap[key].collectionDay = dates.find(
              (d) =>
                d.toDateString() === todayDate.toDateString() ||
                d.toDateString() === tomorrow.toDateString()
            );
          }

          const futureDates = dates.filter((d) => d >= todayDate);
          if (futureDates.length)
            canonicalMap[key].nextCollection = futureDates[0];
        });

        if (cancelled) return;
        setToday(todayLabel);
        setError("");
        setBins(BIN_DEFINITIONS.map((d) => canonicalMap[d.key]));
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setError(`Failed to load bin data: ${err.message}.`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAndParse();
    // Refresh hourly so the today/tomorrow highlighting stays correct
    // when the page is left open past midnight.
    const refreshInterval = setInterval(fetchAndParse, 60 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(refreshInterval);
    };
  }, [selectedAddress]);

  const formatCollectionLabel = (date) => {
    if (!date) return "";
    if (typeof date === "string") return date; // test mode string

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // Round, not floor: across a DST change the gap between midnights
    // is 23 or 25 hours, which would otherwise be off by a day.
    const diffDays = Math.round(
      (targetDate - todayDate) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return <b>Today</b>;
    if (diffDays === 1) return "Tomorrow";
    return `${targetDate.toLocaleDateString("en-GB")} (in ${diffDays} days)`;
  };

  const toTitleCase = (str) =>
    str
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>
        {toTitleCase(selectedAddress)} Bin Collections
      </h1>
      <p style={styles.subheading}>{today}</p>

      <div style={styles.buttonGroup}>
        {Object.keys(ADDRESSES).map((addr) => (
          <button
            key={addr}
            onClick={() => setSelectedAddress(addr)}
            style={{
              ...styles.addressButton,
              backgroundColor: selectedAddress === addr ? "#007bff" : "#f0f0f0",
              color: selectedAddress === addr ? "white" : "#333",
            }}
          >
            {toTitleCase(addr)}
          </button>
        ))}
      </div>

      {testMode && <p style={styles.testBadge}>🧪 Test Mode Active</p>}
      {error && <p style={styles.error}>{error}</p>}
      {loading && !error && (
        <p style={styles.loading}>Loading bin collections…</p>
      )}

      <div style={styles.binList}>
        {bins.map((b) => {
          const displayName =
            b?.displayName || (b?.key ? toTitleCase(b.key) : "Unknown Bin");
          const isDue = !!b?.hasCollectionTodayOrTomorrow;
          const iconColour = isDue ? b?.color || "#007bff" : "#ccc";

          return (
            <div
              key={b?.key || Math.random()}
              style={{ ...styles.binCard, opacity: isDue ? 1 : 0.85 }}
            >
              <div style={styles.iconWrapper}>
                <FontAwesomeIcon icon={faTrash} size="3x" color={iconColour} />
              </div>
              <div style={styles.textContainer}>
                <h2 style={styles.binType}>{displayName}</h2>
                {isDue ? (
                  <p style={styles.collectionDay}>
                    Collection Day: {formatCollectionLabel(b.collectionDay)}
                  </p>
                ) : (
                  <p style={styles.noCollection}>
                    Next Collection: {formatCollectionLabel(b.nextCollection)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Styles */
const styles = {
  container: {
    padding: "2rem",
    fontFamily: "Arial, sans-serif",
    backgroundColor: "#f8f9fa",
    minHeight: "100vh",
  },
  heading: {
    fontSize: "1.8rem",
    textAlign: "center",
    marginBottom: "0.25rem",
    color: "#333",
  },
  subheading: {
    textAlign: "center",
    color: "#666",
    fontSize: "0.95rem",
    marginBottom: "1rem",
  },
  buttonGroup: {
    display: "flex",
    justifyContent: "center",
    gap: "1rem",
    marginBottom: "1rem",
    flexWrap: "wrap",
  },
  addressButton: {
    padding: "0.5rem 1rem",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "1rem",
  },
  testBadge: {
    textAlign: "center",
    color: "#d9534f",
    fontWeight: "bold",
    marginBottom: "1.5rem",
  },
  error: { color: "red", textAlign: "center" },
  loading: { color: "#666", textAlign: "center" },
  binList: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1rem",
  },
  binCard: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "1rem 1rem",
    width: "100%",
    maxWidth: "560px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    transition: "all 0.25s ease",
  },
  iconWrapper: {
    position: "relative",
    marginRight: "1rem",
    minWidth: 54,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  binType: {
    fontSize: "1.1rem",
    margin: 0,
    color: "#000",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  collectionDay: { margin: 0, color: "#555" },
  noCollection: { margin: 0, color: "#888", fontStyle: "italic" },
};
