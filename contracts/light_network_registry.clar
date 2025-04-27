;; Luminess Light Network Registry
;; 
;; A smart contract for registering and managing decentralized lighting networks
;; Features:
;; - Principal-based network ownership
;; - Network metadata storage
;; - Secure registration and update mechanisms

;; Error codes
(define-constant ERR_UNAUTHORIZED u403)
(define-constant ERR_NETWORK_ALREADY_EXISTS u409)
(define-constant ERR_NETWORK_NOT_FOUND u404)
(define-constant ERR_INVALID_NETWORK_NAME u400)

;; Network metadata structure
(define-map networks 
  { network-id: principal }
  {
    name: (string-ascii 50),
    location: (string-ascii 100),
    total-devices: uint,
    owner: principal
  }
)

;; Track total number of registered networks
(define-data-var network-count uint u0)

;; Helper function to validate network name
(define-private (is-valid-network-name (name (string-ascii 50)))
  (and 
    (> (len name) u0)
    (<= (len name) u50)
  )
)

;; Check if a network exists
(define-read-only (network-exists (network-id principal))
  (is-some (map-get? networks { network-id: network-id }))
)

;; Get network details
(define-read-only (get-network-details (network-id principal))
  (map-get? networks { network-id: network-id })
)

;; Register a new lighting network
(define-public (register-network 
  (name (string-ascii 50)) 
  (location (string-ascii 100)) 
  (total-devices uint)
)
  (let 
    (
      (network-id tx-sender)
    )
    (begin
      ;; Validate network name
      (asserts! (is-valid-network-name name) (err ERR_INVALID_NETWORK_NAME))
      
      ;; Check network doesn't already exist
      (asserts! 
        (not (network-exists network-id)) 
        (err ERR_NETWORK_ALREADY_EXISTS)
      )
      
      ;; Register the network
      (map-insert networks 
        { network-id: network-id }
        {
          name: name,
          location: location,
          total-devices: total-devices,
          owner: tx-sender
        }
      )
      
      ;; Increment network count
      (var-set network-count (+ (var-get network-count) u1))
      
      (ok network-id)
    )
  )
)

;; Update network metadata
(define-public (update-network 
  (name (string-ascii 50)) 
  (location (string-ascii 100)) 
  (total-devices uint)
)
  (let 
    (
      (network-id tx-sender)
      (current-network 
        (unwrap! 
          (map-get? networks { network-id: network-id }) 
          (err ERR_NETWORK_NOT_FOUND)
        )
      )
    )
    (begin
      ;; Validate ownership
      (asserts! 
        (is-eq tx-sender (get owner current-network)) 
        (err ERR_UNAUTHORIZED)
      )
      
      ;; Validate network name
      (asserts! (is-valid-network-name name) (err ERR_INVALID_NETWORK_NAME))
      
      ;; Update network metadata
      (map-set networks 
        { network-id: network-id }
        {
          name: name,
          location: location,
          total-devices: total-devices,
          owner: tx-sender
        }
      )
      
      (ok network-id)
    )
  )
)

;; Get total number of registered networks
(define-read-only (get-total-networks)
  (var-get network-count)
)