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
  const [error, setError] = useState("");
  const [today, setToday] = useState("");
  const [testMode, setTestMode] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState("golf place");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isTestMode = params.get("test") === "true";
    setTestMode(isTestMode);

    const fetchAndParse = async () => {
      try {
        const res = await fetch(
          "https://corsproxy.io/?" +
            encodeURIComponent(ADDRESSES[selectedAddress])
        );
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const now = new Date();
        setToday(
          now.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        );

        const canonicalMap = BIN_DEFINITIONS.reduce((acc, def) => {
          acc[def.key] = {
            key: def.key,
            displayName: def.displayName,
            color: def.color,
            hasCollectionTomorrow: false,
            collectionDay: null,
            nextCollection: null,
          };
          return acc;
        }, {});

        if (isTestMode) {
          BIN_DEFINITIONS.forEach((def) => {
            canonicalMap[def.key].hasCollectionTomorrow = true;
            canonicalMap[def.key].collectionDay = "Tomorrow (Test Mode)";
            canonicalMap[def.key].nextCollection = "Tomorrow (Test Mode)";
          });
          setBins(BIN_DEFINITIONS.map((d) => canonicalMap[d.key]));
          return;
        }

        const containers = Array.from(
          doc.querySelectorAll(".waste-type-container")
        );
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

          // Convert date strings to Date objects
          const dates = dateStrings.map((ds) => new Date(ds));

          const todayDate = new Date();
          todayDate.setHours(0, 0, 0, 0);
          const tomorrow = new Date(todayDate);
          tomorrow.setDate(tomorrow.getDate() + 1);

          // Check if tomorrow is included
          const hasTomorrow = dates.some(
            (d) => d.toDateString() === tomorrow.toDateString()
          );
          canonicalMap[key].hasCollectionTomorrow ||= hasTomorrow;
          if (hasTomorrow)
            canonicalMap[key].collectionDay = dates.find(
              (d) => d.toDateString() === tomorrow.toDateString()
            );

          // Calculate next collection
          const futureDates = dates
            .filter((d) => d >= todayDate)
            .sort((a, b) => a - b);
          if (futureDates.length)
            canonicalMap[key].nextCollection = futureDates[0];
        });

        setBins(BIN_DEFINITIONS.map((d) => canonicalMap[d.key]));
      } catch (err) {
        console.error(err);
        setError("Failed to fetch or parse bin data.");
      }
    };

    fetchAndParse();
  }, [selectedAddress]);

  const formatCollectionLabel = (date) => {
    if (!date) return "";
    if (typeof date === "string") return date; // test mode string

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor(
      (targetDate - todayDate) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return "Today";
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

      <div style={styles.binList}>
        {bins.map((b) => {
          const isDue = b.hasCollectionTomorrow;
          const iconColour = isDue ? b.color : "#ccc";

          return (
            <div
              key={b.key}
              style={{ ...styles.binCard, opacity: isDue ? 1 : 0.45 }}
            >
              <div style={styles.iconWrapper}>
                <FontAwesomeIcon icon={faTrash} size="4x" color={iconColour} />
              </div>
              <div>
                <h2 style={styles.binType}>{b.displayName}</h2>
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

      {/* Legend commented out
      <div style={styles.legend}>
        <h3 style={{ marginBottom: "0.5rem" }}>Bin Colour Guide:</h3>
        <ul style={styles.legendList}>
          {BIN_DEFINITIONS.map(d => (
            <li key={d.key}>
              <span style={{ ...styles.legendDot, background: d.color }}></span> {d.displayName}
            </li>
          ))}
        </ul>
      </div>
      */}
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
    padding: "1rem 2rem",
    width: "100%",
    maxWidth: "560px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    transition: "all 0.25s ease",
  },
  iconWrapper: { position: "relative", marginRight: "1rem" },
  binType: { fontSize: "1.1rem", margin: 0 },
  collectionDay: { margin: 0, color: "#555" },
  noCollection: { margin: 0, color: "#888", fontStyle: "italic" },
  legend: { marginTop: "2rem", textAlign: "center", color: "#444" },
  legendList: {
    listStyle: "none",
    padding: 0,
    display: "inline-block",
    textAlign: "left",
    margin: 0,
  },
  legendDot: {
    display: "inline-block",
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    marginRight: "0.5rem",
    verticalAlign: "middle",
  },
};
