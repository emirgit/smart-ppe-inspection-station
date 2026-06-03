/**
 * @file rfid_esp32.h
 * @brief RFID-ESP32 WiFi Card Reader Interface
 *
 * This header file defines the interface for an ESP32-based RFID card reader
 * that communicates with the Raspberry Pi IoT module via WiFi using HTTP.
 * The ESP32 manages the RC522 RFID reader and exposes a REST API for card reading.
 *
 * @author MOD-03 IoT Team
 * @version 0.1
 * @date 29.03.2026
 */

#ifndef RFID_ESP32_H
#define RFID_ESP32_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>
#include <stdbool.h>
#include <time.h>
#include <stddef.h>
#include <stdio.h>

/* ============================================================================
 * CONSTANTS & MACROS
 * ============================================================================ */

/**
 * @defgroup RFID_CONFIG RFID Configuration Constants
 * @{
 */

/** Maximum length of a card UID (hex encoded) */
#define RFID_UID_MAX_LENGTH 16

/** Maximum UID bytes (4 bytes typically, encoded as 8 hex chars + null terminator) */
#define RFID_UID_BYTES 4

/** Card read timeout in milliseconds */
#define RFID_READ_TIMEOUT_MS 1000

/** Maximum retry attempts for card reading */
#define RFID_MAX_RETRIES 3

/** RFID antenna gain setting (0 = min, 7 = max) */
#define RFID_ANTENNA_GAIN 5

/** @} */

/**
 * @defgroup WIFI_CONFIG WiFi Configuration Constants
 * @{
 */

/** Maximum WiFi SSID length */
#define WIFI_SSID_MAX_LENGTH 32

/** Maximum WiFi password length */
#define WIFI_PASSWORD_MAX_LENGTH 64

/** WiFi connection timeout in milliseconds */
#define WIFI_CONNECT_TIMEOUT_MS 10000

/** WiFi reconnection interval in milliseconds */
#define WIFI_RECONNECT_INTERVAL_MS 5000

/** HTTP server port for REST API */
#define HTTP_SERVER_PORT 8080

/** HTTP read timeout in milliseconds */
#define HTTP_TIMEOUT_MS 5000

/** @} */

/**
 * @defgroup GPIO_CONFIG GPIO Pin Configuration
 * @{
 */

/** RC522 CS (Chip Select) pin - ESP32 GPIO number */
#define RFID_CS_PIN 5

/** RC522 RST (Reset) pin - ESP32 GPIO number */
#define RFID_RST_PIN 17

/** RC522 SDA (I2C) / GPIO pin for alternative interface */
#define RFID_SDA_PIN 21

/** RC522 SCL (I2C) / GPIO pin for alternative interface */
#define RFID_SCL_PIN 22

/** Status LED pin (optional - for visual feedback) */
#define STATUS_LED_PIN 2

/** Error LED pin (optional - for error indication) */
#define ERROR_LED_PIN 4

/** @} */

/**
 * @defgroup SPI_CONFIG SPI Configuration
 * @{
 */

/** SPI Bus frequency in Hz (RC522 supports up to 10 MHz) */
#define RFID_SPI_FREQUENCY 1000000

/** SPI Bus number (VSPI = 2, HSPI = 1) */
#define RFID_SPI_BUS 2

/** @} */

/* ============================================================================
 * ENUMERATIONS
 * ============================================================================ */

/**
 * @enum rfid_error_t
 * @brief Error codes for RFID operations
 */
typedef enum {
    RFID_OK = 0,                           /**< Operation successful */
    RFID_ERR_INIT_FAILED = -1,             /**< RFID initialization failed */
    RFID_ERR_NO_CARD = -2,                 /**< No card detected */
    RFID_ERR_INVALID_UID = -3,             /**< Invalid or corrupted UID read */
    RFID_ERR_READ_TIMEOUT = -4,            /**< Card read timeout */
    RFID_ERR_ANTENNA_FAILURE = -5,         /**< RFID antenna communication failed */
    RFID_ERR_SPI_FAILURE = -6,             /**< SPI communication error */
    RFID_ERR_MEMORY_FAILURE = -7,          /**< Memory allocation failure */
    RFID_ERR_INVALID_PARAM = -8            /**< Invalid parameter provided */
} rfid_error_t;

/**
 * @enum rfid_card_type_t
 * @brief Supported RFID card types
 */
typedef enum {
    RFID_CARD_UNKNOWN = 0,                 /**< Unknown card type */
    RFID_CARD_MIFARE_CLASSIC = 1,          /**< MIFARE Classic 1K/4K */
    RFID_CARD_MIFARE_ULTRALIGHT = 2,       /**< MIFARE Ultralight */
    RFID_CARD_MIFARE_PLUS = 3,             /**< MIFARE Plus */
    RFID_CARD_NTAG = 4,                    /**< NTAG series */
    RFID_CARD_ISO_A = 5                    /**< Generic ISO-A card */
} rfid_card_type_t;

/**
 * @enum rfid_state_t
 * @brief RFID reader operational state
 */
typedef enum {
    RFID_STATE_UNINITIALIZED = 0,          /**< Reader not initialized */
    RFID_STATE_IDLE = 1,                   /**< Waiting for card */
    RFID_STATE_DETECTING = 2,              /**< Card detection in progress */
    RFID_STATE_READING = 3,                /**< Reading card data */
    RFID_STATE_ERROR = 4,                  /**< Error state - recovery needed */
    RFID_STATE_SUSPENDED = 5               /**< Reader suspended */
} rfid_state_t;

/**
 * @enum wifi_state_t
 * @brief WiFi connection state
 */
typedef enum {
    WIFI_STATE_DISCONNECTED = 0,           /**< Not connected to WiFi */
    WIFI_STATE_CONNECTING = 1,             /**< WiFi connection in progress */
    WIFI_STATE_CONNECTED = 2,              /**< Connected to WiFi network */
    WIFI_STATE_READY = 3,                  /**< Ready for communication */
    WIFI_STATE_ERROR = 4                   /**< WiFi error state */
} wifi_state_t;

/* ============================================================================
 * TYPE DEFINITIONS & STRUCTURES
 * ============================================================================ */

/**
 * @struct rfid_card_data_t
 * @brief Structure containing RFID card data
 */
typedef struct {
    /** Card UID as hex string (null-terminated) */
    char uid[RFID_UID_MAX_LENGTH];

    /** Raw UID bytes */
    uint8_t uid_bytes[RFID_UID_BYTES];

    /** Number of UID bytes */
    uint8_t uid_size;

    /** Card type detected */
    rfid_card_type_t card_type;

    /** Signal strength (RSSI) if available */
    int8_t signal_strength;

    /** Timestamp when card was detected (Unix epoch) */
    time_t timestamp;

    /** Number of read attempts to get this card */
    uint8_t retry_count;
} rfid_card_data_t;

/**
 * @struct rfid_config_t
 * @brief Configuration parameters for RFID reader
 */
typedef struct {
    /** CS (Chip Select) pin number */
    uint8_t cs_pin;

    /** RST (Reset) pin number */
    uint8_t rst_pin;

    /** SPI frequency in Hz */
    uint32_t spi_freq;

    /** Antenna gain (0-7) */
    uint8_t antenna_gain;

    /** Card read timeout in milliseconds */
    uint16_t read_timeout_ms;

    /** Maximum retry attempts */
    uint8_t max_retries;

    /** Enable debug output */
    bool debug_mode;
} rfid_config_t;

/**
 * @struct wifi_config_t
 * @brief WiFi configuration parameters
 */
typedef struct {
    /** WiFi SSID */
    char ssid[WIFI_SSID_MAX_LENGTH];

    /** WiFi password */
    char password[WIFI_PASSWORD_MAX_LENGTH];

    /** HTTP server port */
    uint16_t http_port;

    /** Connection timeout in milliseconds */
    uint16_t connect_timeout_ms;

    /** Auto-reconnect enabled */
    bool auto_reconnect;

    /** Enable debug output */
    bool debug_mode;
} wifi_config_t;

/**
 * @struct rfid_esp32_context_t
 * @brief Main context structure for RFID-ESP32 module (opaque type)
 *
 * This is an opaque structure - users should not access members directly.
 * Use provided API functions instead.
 */
typedef struct rfid_esp32_context_s rfid_esp32_context_t;

/**
 * @typedef rfid_card_detected_callback_t
 * @brief Callback function type for card detection events
 *
 * @param card_data Pointer to detected card data (valid only during callback)
 * @param user_data User-provided context data
 */
typedef void (*rfid_card_detected_callback_t)(const rfid_card_data_t *card_data, void *user_data);

/**
 * @typedef rfid_error_callback_t
 * @brief Callback function type for error events
 *
 * @param error Error code that occurred
 * @param error_msg Error message (human-readable)
 * @param user_data User-provided context data
 */
typedef void (*rfid_error_callback_t)(rfid_error_t error, const char *error_msg, void *user_data);

/* ============================================================================
 * API FUNCTION DECLARATIONS
 * ============================================================================ */

/**
 * @defgroup RFID_Init Initialization & Lifecycle
 * @{
 */

/**
 * @brief Initialize the RFID-ESP32 module
 *
 * This function initializes the ESP32, configures GPIO pins, and prepares
 * the RC522 RFID reader. Must be called before any other RFID operations.
 *
 * @param[in] rfid_config Configuration for RFID reader (if NULL, uses defaults)
 * @param[in] wifi_config Configuration for WiFi (if NULL, uses defaults)
 *
 * @return Pointer to context on success, NULL on failure
 *
 * @note Call rfid_esp32_get_last_error() for detailed error information
 * @note Default pins: CS=5, RST=17, SPA_FREQ=1MHz, ANTENNA_GAIN=5
 *
 * @code
 * rfid_esp32_context_t *ctx = rfid_esp32_init(NULL, NULL);
 * if (!ctx) {
 *     printf("Failed to init RFID: %s\n", rfid_esp32_get_last_error_msg());
 * }
 * @endcode
 */
rfid_esp32_context_t *rfid_esp32_init(
    const rfid_config_t *rfid_config,
    const wifi_config_t *wifi_config
);

/**
 * @brief Deinitialize and cleanup RFID-ESP32 module
 *
 * This function frees all resources allocated by rfid_esp32_init().
 * The context pointer becomes invalid after this call.
 *
 * @param[in,out] ctx Pointer to context (will be set to NULL after cleanup)
 *
 * @return RFID_OK on success, error code otherwise
 */
rfid_error_t rfid_esp32_deinit(rfid_esp32_context_t **ctx);

/**
 * @brief Reset the RFID reader to initial state
 *
 * Performs a soft reset of the RC522 module. Useful for error recovery.
 *
 * @param[in] ctx Context handle
 *
 * @return RFID_OK on success, error code otherwise
 */
rfid_error_t rfid_esp32_reset(rfid_esp32_context_t *ctx);

/** @} */

/**
 * @defgroup RFID_Operations Card Reading & Detection
 * @{
 */

/**
 * @brief Read a single card (blocking call with timeout)
 *
 * This function blocks until a card is detected and read, or the timeout
 * expires. Use in polling loop or separate thread for non-blocking behavior.
 *
 * @param[in] ctx Context handle
 * @param[out] card_data Pointer to card data structure to fill
 * @param[in] timeout_ms Maximum time to wait in milliseconds (0 = use default)
 *
 * @return RFID_OK if card successfully read, error code otherwise
 *
 * @retval RFID_OK Card successfully read, card_data is valid
 * @retval RFID_ERR_NO_CARD No card detected within timeout
 * @retval RFID_ERR_READ_TIMEOUT Read operation timed out
 * @retval RFID_ERR_INVALID_UID UID data corrupted or invalid
 *
 * @note Thread-safe if thread safety is enabled at compile time
 *
 * @code
 * rfid_card_data_t card;
 * if (rfid_esp32_read_card(ctx, &card, 2000) == RFID_OK) {
 *     printf("Card UID: %s\n", card.uid);
 * }
 * @endcode
 */
rfid_error_t rfid_esp32_read_card(
    rfid_esp32_context_t *ctx,
    rfid_card_data_t *card_data,
    uint16_t timeout_ms
);

/**
 * @brief Non-blocking card detection check
 *
 * Returns immediately with card data if available, or error if none.
 * Use this in polling loops for non-blocking operation.
 *
 * @param[in] ctx Context handle
 * @param[out] card_data Pointer to card data structure to fill
 *
 * @return RFID_OK if card detected, RFID_ERR_NO_CARD if not, other errors otherwise
 *
 * @note Call this repeatedly in polling loop for continuous card detection
 *
 * @code
 * while (continuing) {
 *     rfid_card_data_t card;
 *     if (rfid_esp32_detect_card(ctx, &card) == RFID_OK) {
 *         handle_card_detected(&card);
 *     }
 *     osDelay(100); // 100ms polling interval
 * }
 * @endcode
 */
rfid_error_t rfid_esp32_detect_card(
    rfid_esp32_context_t *ctx,
    rfid_card_data_t *card_data
);

/**
 * @brief Force antenna search/power cycle
 *
 * Initiates antenna field generation for fresh card detection.
 * Useful when card is already present but not being read.
 *
 * @param[in] ctx Context handle
 * @param[in] power_off_ms Milliseconds to keep antenna off (0 = default 10ms)
 *
 * @return RFID_OK on success, error code otherwise
 */
rfid_error_t rfid_esp32_antenna_cycle(
    rfid_esp32_context_t *ctx,
    uint16_t power_off_ms
);

/** @} */

/**
 * @defgroup RFID_Callbacks Event Callbacks
 * @{
 */

/**
 * @brief Register callback for card detection events
 *
 * When a card is detected, the registered callback will be invoked.
 * Callback is called from interrupt context - keep it short!
 *
 * @param[in] ctx Context handle
 * @param[in] callback Function to call on card detection (NULL = unregister)
 * @param[in] user_data Context data passed to callback
 *
 * @return RFID_OK on success, error code otherwise
 *
 * @note Only one callback can be registered at a time
 * @note Callback called from ISR/interrupt - must be fast and non-blocking
 */
rfid_error_t rfid_esp32_register_card_callback(
    rfid_esp32_context_t *ctx,
    rfid_card_detected_callback_t callback,
    void *user_data
);

/**
 * @brief Register callback for error events
 *
 * When an error occurs, the registered callback will be invoked.
 *
 * @param[in] ctx Context handle
 * @param[in] callback Function to call on error (NULL = unregister)
 * @param[in] user_data Context data passed to callback
 *
 * @return RFID_OK on success, error code otherwise
 */
rfid_error_t rfid_esp32_register_error_callback(
    rfid_esp32_context_t *ctx,
    rfid_error_callback_t callback,
    void *user_data
);

/** @} */

/**
 * @defgroup RFID_Status Status & Diagnostics
 * @{
 */

/**
 * @brief Get current RFID reader state
 *
 * @param[in] ctx Context handle
 *
 * @return Current state of the RFID reader
 */
rfid_state_t rfid_esp32_get_state(rfid_esp32_context_t *ctx);

/**
 * @brief Get last error code
 *
 * Returns the error code from the most recent failed operation.
 *
 * @param[in] ctx Context handle
 *
 * @return Last error code that occurred
 */
rfid_error_t rfid_esp32_get_last_error(rfid_esp32_context_t *ctx);

/**
 * @brief Get human-readable error message
 *
 * @param[in] error Error code
 *
 * @return Pointer to static error message string
 */
const char *rfid_esp32_error_to_string(rfid_error_t error);

/**
 * @brief Get last error message
 *
 * @param[in] ctx Context handle
 *
 * @return Human-readable error message
 */
const char *rfid_esp32_get_last_error_msg(rfid_esp32_context_t *ctx);

/**
 * @brief Get RFID reader version
 *
 * Queries the RC522 firmware version register.
 *
 * @param[in] ctx Context handle
 * @param[out] version_ptr Pointer to uint8_t to receive version
 *
 * @return RFID_OK on success, error code otherwise
 *
 * @code
 * uint8_t version;
 * rfid_esp32_get_version(ctx, &version);
 * printf("RC522 Version: 0x%02X\n", version);
 * @endcode
 */
rfid_error_t rfid_esp32_get_version(rfid_esp32_context_t *ctx, uint8_t *version_ptr);

/**
 * @brief Get RFID reader diagnostics
 *
 * Performs self-diagnostic check on RC522 module.
 *
 * @param[in] ctx Context handle
 * @param[out] diag_result Diagnostic result code
 *
 * @return RFID_OK if diagnostics run successfully, error code otherwise
 * @retval RFID_OK if all diagnostics pass
 * @note Check diag_result for detailed diagnostic flags
 */
rfid_error_t rfid_esp32_get_diagnostics(rfid_esp32_context_t *ctx, uint8_t *diag_result);

/** @} */

/**
 * @defgroup RFID_Configuration Configuration & Tuning
 * @{
 */

/**
 * @brief Set antenna gain level
 *
 * Adjusts the RF antenna gain amplifier (0 = minimum, 7 = maximum).
 *
 * @param[in] ctx Context handle
 * @param[in] gain Gain level (0-7)
 *
 * @return RFID_OK on success, error code otherwise
 *
 * @note Higher gain may improve range but can cause noise
 */
rfid_error_t rfid_esp32_set_antenna_gain(rfid_esp32_context_t *ctx, uint8_t gain);

/**
 * @brief Get current antenna gain level
 *
 * @param[in] ctx Context handle
 * @param[out] gain_ptr Pointer to receive current gain level
 *
 * @return RFID_OK on success, error code otherwise
 */
rfid_error_t rfid_esp32_get_antenna_gain(rfid_esp32_context_t *ctx, uint8_t *gain_ptr);

/**
 * @brief Enable/disable antenna output
 *
 * Turns the antenna RF field on/off for power management.
 *
 * @param[in] ctx Context handle
 * @param[in] enabled true to enable antenna, false to disable
 *
 * @return RFID_OK on success, error code otherwise
 */
rfid_error_t rfid_esp32_set_antenna_enabled(rfid_esp32_context_t *ctx, bool enabled);

/** @} */

/**
 * @defgroup RFID_WiFi WiFi & HTTP API
 * @{
 */

/**
 * @brief Get current WiFi connection state
 *
 * @param[in] ctx Context handle
 *
 * @return Current WiFi state
 */
wifi_state_t rfid_esp32_get_wifi_state(rfid_esp32_context_t *ctx);

/**
 * @brief Connect to WiFi network
 *
 * Initiates connection to configured WiFi network.
 *
 * @param[in] ctx Context handle
 * @param[in] ssid WiFi SSID (network name)
 * @param[in] password WiFi password
 *
 * @return RFID_OK on success, error code otherwise
 *
 * @note Blocks until connection succeeds or timeout expires
 * @note Use wifi.auto_reconnect for automatic reconnection
 */
rfid_error_t rfid_esp32_wifi_connect(
    rfid_esp32_context_t *ctx,
    const char *ssid,
    const char *password
);

/**
 * @brief Disconnect from WiFi network
 *
 * @param[in] ctx Context handle
 *
 * @return RFID_OK on success, error code otherwise
 */
rfid_error_t rfid_esp32_wifi_disconnect(rfid_esp32_context_t *ctx);

/**
 * @brief Get HTTP server URL for remote access
 *
 * Returns the URL where this ESP32 is listening for HTTP requests.
 * On Raspberry Pi, connect to this URL to query for cards via WiFi.
 *
 * @param[in] ctx Context handle
 * @param[out] url_buffer Buffer to receive URL string
 * @param[in] buffer_size Size of url_buffer
 *
 * @return RFID_OK on success, error code otherwise
 *
 * @code
 * char url[64];
 * rfid_esp32_get_http_url(ctx, url, sizeof(url));
 * printf("Connect to: %s/read_card\n", url);
 * // e.g., "http://192.168.1.100:8080/read_card"
 * @endcode
 */
rfid_error_t rfid_esp32_get_http_url(
    rfid_esp32_context_t *ctx,
    char *url_buffer,
    size_t buffer_size
);

/** @} */

/**
 * @defgroup RFID_Maintenance Maintenance & Debug
 * @{
 */

/**
 * @brief Enable/disable debug output
 *
 * When enabled, debug information is printed to serial port.
 *
 * @param[in] ctx Context handle
 * @param[in] enabled true to enable debug output
 *
 * @return RFID_OK on success, error code otherwise
 */
rfid_error_t rfid_esp32_set_debug_enabled(rfid_esp32_context_t *ctx, bool enabled);

/**
 * @brief Print diagnostics and status information
 *
 * Useful for debugging and verifying system state.
 *
 * @param[in] ctx Context handle
 *
 * @return RFID_OK on success, error code otherwise
 */
rfid_error_t rfid_esp32_print_status(rfid_esp32_context_t *ctx);

/**
 * @brief Get module version string
 *
 * @return Version string (e.g., "1.0.0")
 */
const char *rfid_esp32_get_version_string(void);

/** @} */

/* ============================================================================
 * HELPER MACROS
 * ============================================================================ */

/**
 * @brief Check if error is success
 * @param err Error code to check
 * @return true if err == RFID_OK, false otherwise
 */
#define RFID_IS_OK(err) ((err) == RFID_OK)

/**
 * @brief Check if error is a failure
 * @param err Error code to check
 * @return true if err != RFID_OK, false otherwise
 */
#define RFID_IS_ERROR(err) ((err) != RFID_OK)

/**
 * @brief Quick error check with logging
 * @param err Error code to check
 * @param msg Message to print on error
 */
#define RFID_ASSERT(err, msg) \
    do { \
        if (RFID_IS_ERROR(err)) { \
            fprintf(stderr, "RFID Error [%d]: %s\n", err, msg); \
        } \
    } while (0)

/* ============================================================================
 * CONSTANTS - Error Message Strings
 * ============================================================================ */

extern const char *RFID_ERROR_MESSAGES[];

#ifdef __cplusplus
}
#endif

#endif /* RFID_ESP32_H */
