import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError } from '@/lib/api-utils';
import { productSchema } from '@/lib/validation/schemas';
import { parsePaginationParams } from '@/lib/format';
import { recordAuditLog } from '@/lib/services/audit';
import type { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const url = req.nextUrl;
    if (url.searchParams.get('all') === '1') {
      const inStockOnly = url.searchParams.get('inStockOnly') === '1';
      const items = await prisma.product.findMany({
        where: {
          status: 'ACTIVE',
          ...(inStockOnly ? { currentStock: { gt: 0 } } : {}),
        },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          sku: true,
          brand: true,
          model: true,
          condition: true,
          purchasePrice: true,
          sellingPrice: true,
          currentStock: true,
          minimumStock: true,
          inventoryType: true,
          category: { select: { id: true, name: true } },
          serializedItems: {
            where: { stockStatus: 'IN_STOCK' },
            select: {
              id: true,
              serialNumber: true,
              purchasePrice: true,
              sellingPrice: true,
              condition: true,
            },
          },
        },
      });
      return NextResponse.json({ items });
    }

    const { page, pageSize, search, sortBy, sortOrder } = parsePaginationParams(url.searchParams);
    const categoryId = url.searchParams.get('categoryId') || '';
    const condition = url.searchParams.get('condition') || '';
    const inventoryType = url.searchParams.get('inventoryType') || '';
    const stockFilter = url.searchParams.get('stockFilter') || '';
    const status = url.searchParams.get('status') || '';

    const where: Prisma.ProductWhereInput = {
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { sku: { contains: search } },
              { brand: { contains: search } },
              { model: { contains: search } },
              { processor: { contains: search } },
            ],
          }
        : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(condition === 'NEW' || condition === 'USED' || condition === 'REFURBISHED'
        ? { condition }
        : {}),
      ...(inventoryType === 'SERIALIZED' || inventoryType === 'QUANTITY' ? { inventoryType } : {}),
      ...(status === 'ACTIVE' || status === 'INACTIVE' ? { status } : {}),
      ...(stockFilter === 'OUT_OF_STOCK' ? { currentStock: 0 } : {}),
      ...(stockFilter === 'IN_STOCK' ? { currentStock: { gt: 0 } } : {}),
    };

    const allowedSortFields = ['name', 'sku', 'purchasePrice', 'sellingPrice', 'currentStock', 'createdAt'];
    const orderField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    // Handle low stock filter accurately when requested
    if (stockFilter === 'LOW_STOCK') {
      const allActive = await prisma.product.findMany({
        where,
        orderBy: { [orderField]: sortOrder },
        include: { category: { select: { id: true, name: true } } },
      });
      const filtered = allActive.filter((p) => p.currentStock > 0 && p.currentStock <= p.minimumStock);
      const total = filtered.length;
      const sliced = filtered.slice((page - 1) * pageSize, page * pageSize);
      return NextResponse.json({
        items: sliced,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    }

    const [total, items] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: { [orderField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: { select: { id: true, name: true } },
        },
      }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json();
    const data = productSchema.parse(body);

    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...data,
          processor: data.processor || null,
          ram: data.ram || null,
          ssd: data.ssd || null,
          hdd: data.hdd || null,
          storage: data.storage || null,
          screenSize: data.screenSize || null,
          description: data.description || null,
        },
        include: { category: { select: { id: true, name: true } } },
      });

      await recordAuditLog(tx, {
        entityType: 'Product',
        entityId: product.id,
        action: 'CREATE',
        updatedData: { name: product.name, sku: product.sku },
        adminUserId: auth.session.userId,
      });

      return product;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
