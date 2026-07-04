import rawRecommendations from "../../mock_recommendations.json";

export const recommendations = rawRecommendations;

export const wards = [
  ...new Set(recommendations.map((item) => item.ward_name)),
].sort();

export const categories = [
  ...new Set(recommendations.map((item) => item.category)),
].sort();

export const statusLabels = {
  new: "New",
  taken_up: "Taken Up",
  in_progress: "In Progress",
  resolved: "Resolved",
  parked: "Parked",
};

export const statusOrder = [
  "new",
  "taken_up",
  "in_progress",
  "resolved",
  "parked",
];
