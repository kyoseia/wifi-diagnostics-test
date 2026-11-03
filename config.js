/*
 * Wi-Fi Diagnostics dashboard configuration
 *
 * Create a ThingSpeak channel with four numeric fields:
 *   Field 1: Wi-Fi RSSI (dBm, usually a negative number such as -58)
 *   Field 2: Network probe latency (ms)
 *   Field 3: Device uptime (minutes)
 *   Field 4: Wi-Fi reconnect count
 *
 * For a public channel, leave READ_API_KEY blank.
 * If the channel is private, this read-only key will be visible to anyone
 * who can open this public website. NEVER put the WRITE API KEY here.
 */
window.WIFI_DIAGNOSTICS_CONFIG = {
  CHANNEL_ID: "3564253",
  READ_API_KEY: "",
  REFRESH_MS: 15000,
  RESULTS: 60,
  STALE_AFTER_MS: 180000,
  TIME_ZONE: "Asia/Manila",
  METRICS: [
    { field: "field1", label: "Wi-Fi signal", unit: "dBm", precision: 0, format: "number" },
    { field: "field2", label: "Network latency", unit: "ms", precision: 0, format: "number" },
    { field: "field3", label: "Device uptime", unit: "min", precision: 0, format: "number" },
    { field: "field4", label: "Wi-Fi reconnects", unit: "count", precision: 0, format: "number" }
  ]
};
