import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CATEGORY_MAPPING: Record<string, string[]> = {
  'tech': ['smartphones', 'laptops', 'mobile-accessories', 'tablets'],
  'food': ['groceries'],
  'fashion': ['mens-shirts', 'mens-shoes', 'womens-dresses', 'womens-shoes', 'womens-watches', 'womens-bags', 'womens-jewellery', 'sunglasses', 'tops'],
  'home': ['home-decoration', 'furniture', 'lighting', 'kitchen-accessories'],
  'luxury': ['fragrances', 'skincare', 'automotive', 'motorcycle', 'sports-accessories']
};

async function getDummyJSONProducts(): Promise<any[]> {
  try {
    // Fetch all products (limit 194 is max currently)
    const response = await fetch('https://dummyjson.com/products?limit=0');
    if (!response.ok) throw new Error('DummyJSON API Error');
    
    const data = await response.json();
    return (data.products || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      price: p.price,
      image: p.thumbnail || (p.images && p.images[0]) || '',
      category: p.category,
      description: p.description,
      currency: '$'
    }));
  } catch (e) {
    console.error('DummyJSON Error', e);
    return [];
  }
}

async function getFakeStoreProducts(): Promise<any[]> {
  try {
    const response = await fetch('https://fakestoreapi.com/products');
    if (!response.ok) throw new Error('FakeStore API Error');
    
    const data = await response.json();
    return data.map((p: any) => ({
      id: `fs-${p.id}`,
      title: p.title,
      price: p.price,
      image: p.image,
      category: p.category, // electronics, jewelery, men's clothing, women's clothing
      description: p.description,
      currency: '$'
    }));
  } catch (e) {
    console.error('FakeStore Error', e);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get('count') || '5', 10);
    const categoryParam = searchParams.get('category'); // 'tech', 'food', etc.

    let allProducts = await getDummyJSONProducts();
    
    if (allProducts.length === 0) {
      allProducts = await getFakeStoreProducts();
    }

    // Filter by category if specified
    if (categoryParam && categoryParam !== 'all' && CATEGORY_MAPPING[categoryParam]) {
      const allowedCategories = CATEGORY_MAPPING[categoryParam];
      allProducts = allProducts.filter(p => allowedCategories.includes(p.category));
    }

    // Shuffle
    for (let i = allProducts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allProducts[i], allProducts[j]] = [allProducts[j], allProducts[i]];
    }

    // Ensure we have enough products
    if (allProducts.length === 0) {
        // Fallback mock data if everything fails
        allProducts = [
            { id: 'mock1', title: 'iPhone 13 Pro', price: 999, image: 'https://dummyjson.com/image/i/products/1/thumbnail.jpg', currency: '$' },
            { id: 'mock2', title: 'Samsung Universe 9', price: 1249, image: 'https://dummyjson.com/image/i/products/2/thumbnail.jpg', currency: '$' },
            { id: 'mock3', title: 'OPPOF19', price: 280, image: 'https://dummyjson.com/image/i/products/4/thumbnail.jpg', currency: '$' },
        ];
    }

    return NextResponse.json(allProducts.slice(0, count));
  } catch (error) {
    console.error('Error in PriceGuessr API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
