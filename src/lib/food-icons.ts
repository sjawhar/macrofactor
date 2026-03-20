/**
 * Map MacroFactor imageId values to food emojis.
 * These IDs come from the Typesense food database and Firestore entries.
 * Common mappings derived from food categories and USDA food groups.
 */
const IMAGE_ID_MAP: Record<string, string> = {
  // Fruits
  '611': '🍌', // Banana
  '600': '🍎', // Apple
  '601': '🍊', // Citrus/Orange
  '602': '🍇', // Grape
  '603': '🍓', // Berry/Strawberry
  '604': '🍑', // Stone fruit
  '605': '🍉', // Melon
  '606': '🥝', // Kiwi/Tropical
  '607': '🍍', // Pineapple
  '608': '🥭', // Mango
  '609': '🍋', // Lemon/Lime
  '610': '🫐', // Blueberry

  // Protein / Meats
  '200': '🥩', // Red meat
  '201': '🥩', // Beef
  '202': '🐖', // Pork
  '203': '🍗', // Poultry general
  '204': '🍗', // Chicken
  '205': '🦃', // Turkey
  '206': '🐟', // Fish
  '207': '🦐', // Seafood/Shellfish
  '208': '🥚', // Egg

  // Dairy
  '300': '🥛', // Milk
  '301': '🧀', // Cheese
  '302': '🍦', // Ice cream/Frozen dairy
  '303': '🧈', // Butter
  '304': '🥛', // Yogurt

  // Grains / Carbs
  '400': '🍞', // Bread
  '401': '🌾', // Grain/Cereal
  '402': '🍝', // Pasta
  '403': '🍚', // Rice
  '404': '🥣', // Oatmeal/Cereal
  '405': '🥐', // Pastry

  // Vegetables
  '500': '🥦', // Cruciferous
  '501': '🥬', // Leafy green
  '502': '🥕', // Root vegetable
  '503': '🍅', // Tomato
  '504': '🌽', // Corn
  '505': '🥔', // Potato
  '506': '🫘', // Legume/Bean
  '507': '🧅', // Onion/Allium
  '508': '🫑', // Pepper
  '509': '🥒', // Cucumber
  '510': '🍄', // Mushroom
  '511': '🥗', // Salad
  '512': '🥑', // Avocado
  '513': '🌶️', // Hot pepper
  '514': '🫛', // Peas

  // Nuts & Seeds
  '700': '🥜', // Peanut/Nut
  '701': '🌰', // Tree nut
  '702': '🫘', // Seed

  // Oils & Fats
  '800': '🫒', // Olive oil
  '801': '🧈', // Fat/Oil

  // Beverages
  '900': '☕', // Coffee
  '901': '🍵', // Tea
  '902': '🥤', // Soft drink/Juice
  '903': '💧', // Water
  '904': '🍺', // Beer
  '905': '🍷', // Wine

  // Prepared / Mixed
  '100': '🍽️', // Generic prepared food
  '101': '🍔', // Burger/Sandwich
  '102': '🌮', // Taco/Mexican
  '103': '🍕', // Pizza
  '104': '🍜', // Soup/Noodle
  '105': '🥪', // Sandwich
  '106': '🫔', // Wrap/Burrito
  '107': '🥙', // Pita/Flatbread

  // Snacks & Sweets
  '540': '🍫', // Chocolate
  '541': '🍪', // Cookie
  '542': '🍬', // Candy
  '543': '🧁', // Cake/Cupcake
  '544': '🍩', // Donut
  '545': '🥜', // Snack bar

  // Supplements
  '950': '💊', // Supplement/Vitamin
  '951': '🧉', // Protein shake
};

/**
 * Get a food emoji for a given imageId.
 * Falls back to a generic food icon if no mapping exists.
 */
export function foodIcon(imageId?: string | number): string {
  if (imageId == null) return '🍽️';
  const id = String(imageId);
  return IMAGE_ID_MAP[id] ?? '🍽️';
}

/**
 * Get a food emoji based on food name heuristics when imageId is unavailable.
 */
export function foodIconFromName(name?: string): string {
  if (!name) return '🍽️';
  const lower = name.toLowerCase();

  if (lower.includes('chicken') || lower.includes('poultry')) return '🍗';
  if (lower.includes('beef') || lower.includes('steak')) return '🥩';
  if (lower.includes('pork') || lower.includes('bacon') || lower.includes('ham')) return '🥓';
  if (lower.includes('fish') || lower.includes('salmon') || lower.includes('tuna')) return '🐟';
  if (lower.includes('shrimp') || lower.includes('prawn') || lower.includes('lobster')) return '🦐';
  if (lower.includes('turkey')) return '🦃';
  if (lower.includes('egg')) return '🥚';

  if (lower.includes('milk') || lower.includes('yogurt') || lower.includes('yoghurt')) return '🥛';
  if (lower.includes('cheese')) return '🧀';
  if (lower.includes('butter')) return '🧈';
  if (lower.includes('cream')) return '🍦';
  if (lower.includes('whey') || lower.includes('protein shake') || lower.includes('protein powder')) return '🥤';

  if (lower.includes('banana')) return '🍌';
  if (lower.includes('apple')) return '🍎';
  if (lower.includes('orange')) return '🍊';
  if (lower.includes('berry') || lower.includes('blueberry') || lower.includes('strawberry')) return '🫐';
  if (lower.includes('grape')) return '🍇';
  if (lower.includes('lemon') || lower.includes('lime')) return '🍋';
  if (lower.includes('avocado')) return '🥑';
  if (lower.includes('mango')) return '🥭';
  if (lower.includes('peach') || lower.includes('nectarine')) return '🍑';
  if (lower.includes('melon') || lower.includes('watermelon')) return '🍉';
  if (lower.includes('pineapple')) return '🍍';

  if (lower.includes('bread') || lower.includes('toast')) return '🍞';
  if (lower.includes('rice')) return '🍚';
  if (lower.includes('pasta') || lower.includes('spaghetti') || lower.includes('noodle')) return '🍝';
  if (lower.includes('oat') || lower.includes('cereal') || lower.includes('granola')) return '🥣';
  if (lower.includes('bagel') || lower.includes('muffin') || lower.includes('croissant')) return '🥐';
  if (lower.includes('tortilla') || lower.includes('wrap')) return '🫔';
  if (lower.includes('pancake') || lower.includes('waffle')) return '🧇';

  if (lower.includes('broccoli') || lower.includes('cauliflower')) return '🥦';
  if (lower.includes('carrot')) return '🥕';
  if (lower.includes('tomato')) return '🍅';
  if (lower.includes('potato') || lower.includes('sweet potato')) return '🥔';
  if (lower.includes('corn')) return '🌽';
  if (lower.includes('spinach') || lower.includes('kale') || lower.includes('lettuce')) return '🥬';
  if (lower.includes('pepper') || lower.includes('capsicum')) return '🫑';
  if (lower.includes('onion') || lower.includes('garlic')) return '🧅';
  if (lower.includes('mushroom')) return '🍄';
  if (lower.includes('cucumber') || lower.includes('zucchini')) return '🥒';
  if (lower.includes('bean') || lower.includes('lentil') || lower.includes('chickpea')) return '🫘';
  if (lower.includes('pea')) return '🫛';
  if (lower.includes('salad')) return '🥗';

  if (lower.includes('nut') || lower.includes('almond') || lower.includes('cashew') || lower.includes('walnut')) return '🥜';
  if (lower.includes('peanut butter')) return '🥜';
  if (lower.includes('seed') || lower.includes('chia') || lower.includes('flax')) return '🌰';

  if (lower.includes('olive oil') || lower.includes('coconut oil')) return '🫒';
  if (lower.includes('oil')) return '🧈';

  if (lower.includes('coffee') || lower.includes('espresso') || lower.includes('latte')) return '☕';
  if (lower.includes('tea')) return '🍵';
  if (lower.includes('juice') || lower.includes('smoothie')) return '🥤';
  if (lower.includes('water')) return '💧';
  if (lower.includes('beer') || lower.includes('ale')) return '🍺';
  if (lower.includes('wine')) return '🍷';
  if (lower.includes('soda') || lower.includes('cola')) return '🥤';

  if (lower.includes('pizza')) return '🍕';
  if (lower.includes('burger') || lower.includes('hamburger')) return '🍔';
  if (lower.includes('sandwich') || lower.includes('sub')) return '🥪';
  if (lower.includes('taco') || lower.includes('burrito')) return '🌮';
  if (lower.includes('soup') || lower.includes('stew') || lower.includes('chili')) return '🍜';
  if (lower.includes('sushi')) return '🍣';

  if (lower.includes('chocolate')) return '🍫';
  if (lower.includes('cookie') || lower.includes('biscuit')) return '🍪';
  if (lower.includes('cake') || lower.includes('brownie')) return '🧁';
  if (lower.includes('candy') || lower.includes('gummy')) return '🍬';
  if (lower.includes('ice cream') || lower.includes('gelato')) return '🍨';
  if (lower.includes('donut') || lower.includes('doughnut')) return '🍩';
  if (lower.includes('pie')) return '🥧';

  if (lower.includes('bar') || lower.includes('protein bar')) return '🍫';
  if (lower.includes('powder') || lower.includes('supplement')) return '💊';
  if (lower.includes('sugar') || lower.includes('honey') || lower.includes('syrup')) return '🍯';
  if (lower.includes('salt') || lower.includes('seasoning') || lower.includes('spice')) return '🧂';
  if (lower.includes('sauce') || lower.includes('ketchup') || lower.includes('mustard')) return '🥫';

  return '🍽️';
}
