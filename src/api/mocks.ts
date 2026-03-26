/**
 * mocks.ts — Mock Strava Data for Local Development
 */

export const MOCK_ACTIVITIES = [
    {
        id: 101,
        name: "Morning Run in the City",
        type: "Run",
        distance: 8520,
        moving_time: 2520,
        elapsed_time: 2600,
        average_speed: 3.38,
        max_speed: 4.5,
        average_heartrate: 155,
        max_heartrate: 178,
        start_date_local: new Date().toISOString(),
        start_date: new Date().toISOString(),
        map: {
            summary_polyline: "mq`eF|~uS@h@dBf@z@b@dBZ\\j@`AZ`AZ`AZ`AZ`AZ`AZ`AZ`AZ`AZ`AZ`AZ`AZ`A" // Simplified mock path
        },
        splits_metric: [
            { split: 1, distance: 1000, elapsed_time: 300, moving_time: 300, average_speed: 3.33 },
            { split: 2, distance: 1000, elapsed_time: 295, moving_time: 295, average_speed: 3.39 },
            { split: 3, distance: 1000, elapsed_time: 310, moving_time: 310, average_speed: 3.22 }
        ]
    },
    {
        id: 102,
        name: "Evening Bike Ride",
        type: "Ride",
        distance: 25400,
        moving_time: 3600,
        elapsed_time: 3800,
        average_speed: 7.05,
        max_speed: 12.5,
        average_heartrate: 135,
        max_heartrate: 160,
        start_date_local: new Date().toISOString(),
        start_date: new Date().toISOString(),
        map: {
            summary_polyline: "u~_eFv_uS@h@dBf@z@b@dBZ\\j@`AZ`AZ`AZ`AZ`AZ`AZ`AZ`AZ`AZ`AZ`AZ`AZ`A"
        }
    },
    {
        id: 103,
        name: "Morning Hike",
        type: "Hike",
        distance: 5200,
        moving_time: 5400,
        elapsed_time: 6000,
        average_speed: 0.96,
        max_speed: 1.5,
        average_heartrate: 110,
        max_heartrate: 130,
        start_date_local: new Date().toISOString(),
        start_date: new Date().toISOString(),
        map: {
            summary_polyline: "mq`eF|~uSAAAAAAAAAAAAAAA"
        }
    },
    {
        id: 104,
        name: "Gym Workout",
        type: "WeightTraining",
        distance: 0,
        moving_time: 3600,
        elapsed_time: 4000,
        average_speed: 0,
        max_speed: 0,
        average_heartrate: 120,
        max_heartrate: 165,
        start_date_local: new Date().toISOString(),
        start_date: new Date().toISOString()
    }
];
