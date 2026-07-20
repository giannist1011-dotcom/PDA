export const emptyItem = (categoryId = "") => ({
  id: null,
  name: "",
  price: "",
  category: categoryId,
  customizable: false,
  double_meat_eligible: false,
  option_groups: [],
  photo_id: null,
});
