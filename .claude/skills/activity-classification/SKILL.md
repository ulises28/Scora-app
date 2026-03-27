---
name: activity-classification
description: Rules for classifying and naming activities based on their data content, specifically distance vs map data.
---

# Activity Classification Rules

## 1. Core Distinction: Distance vs No Distance
NEVER classify activities as "GPS" or "non-GPS". This is a recurring mistake. 
Instead, classify them based on the presence of **Distance**.

- **Activities with Distance**: Any activity where `activity.distance > 0`. 
    - *Example*: Runs, Rides, even "Private Runs" that have distance/pace metrics but NO map data.
- **Activities without Distance**: Any activity where `activity.distance === 0`.
    - *Example*: Weight Training, Yoga, Stationary activities.

## 2. Terminology and Variables
- **DON'T USE**: `gpsActivity`, `isGPS`, `gps_rendering_test`.
- **USE**: `activityWithDistance`, `hasDistance`, `distance_based_verification`.

## 3. Map Data is Optional
An activity can have **Distance** but **No Map** (e.g., if it's marked as Private in Strava). 
Sticker rendering logic should rely on `activity.distance > 0` to decide whether to show distance/pace metrics, NOT on the presence of a polyline/map.

## 4. Testing Implications
When writing E2E tests:
1. Always extract expected values (distance, pace, duration) directly from the input JSON.
2. Use the app's internal logic (e.g., `formatActivityStats`) to derive the exact strings the UI should display.
3. Ensure tests adapt to *any* JSON payload by finding activities that satisfy the `distance > 0` or `distance === 0` conditions dynamically.
