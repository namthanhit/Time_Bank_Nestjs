export enum JobStatus {
    PENDING = "pending",
    OPEN = "open",
    MATCHED = "matched",
    COMPLETED = "completed",
    CANCELLED = "cancelled",
    EXPIRED = "expired",
    BANNED = "banned"
}

export enum JobVisibility {
    PUBLIC = "public",
    FRIENDS = "friends",
    HIDDEN = "hidden",
}