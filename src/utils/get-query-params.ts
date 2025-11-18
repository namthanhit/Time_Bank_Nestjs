import { PaginationRequestDto as RawQueryParams } from 'src/typings/dtos/pagination.dto';
import { SortOrder } from 'src/typings/enums/common.enum';

export type QueryParams = {
  paging: {
    skip: number;
    take: number;
  };
  orderBy?: {
    [key: string]: SortOrder;
  };
};

export interface QueryParamsConfig extends RawQueryParams {
  isSort?: Boolean;
}

export type getQueryParamsResult = {
  queryParams: QueryParams;
  metadata: {
    page: number;
    pageSize: number;
    sortBy: string;
    sortOrder: SortOrder;
  };
};

const DEFAULT_VALUE_PAGING = {
  page: 0,
  limit: 10,
  sortBy: 'created_at',
  sortOrder: SortOrder.desc,
};

export function getQueryParams(
  queryParams: RawQueryParams,
): getQueryParamsResult {
  const page = queryParams.page || DEFAULT_VALUE_PAGING.page;
  const pageSize = queryParams.pageSize || DEFAULT_VALUE_PAGING.limit;
  const sortBy = queryParams.sortBy ?? DEFAULT_VALUE_PAGING.sortBy;
  const sortOrder = queryParams.sortOrder ?? DEFAULT_VALUE_PAGING.sortOrder;

  const queryParamsResult: QueryParams = {
    paging: {
      skip: 0,
      take: page * pageSize,
    },
    orderBy: sortBy ? { [`${sortBy}`]: sortOrder } : { [sortBy]: sortOrder },
  };

  return {
    queryParams: queryParamsResult,
    metadata: { page, pageSize, sortBy, sortOrder },
  };
}

export function getQueryParamsForAdmin(
  queryParams: RawQueryParams,
): getQueryParamsResult {
  const page = queryParams.page || DEFAULT_VALUE_PAGING.page;
  const pageSize = queryParams.pageSize || DEFAULT_VALUE_PAGING.limit;
  const sortBy = queryParams.sortBy ?? DEFAULT_VALUE_PAGING.sortBy;
  const sortOrder = queryParams.sortOrder ?? DEFAULT_VALUE_PAGING.sortOrder;

  const queryParamsResult: QueryParams = {
    paging: {
      skip: page > 0 ? (page - 1) * pageSize : 0,
      take: pageSize > 0 ? pageSize : 10,
    },
    orderBy: sortBy ? { [`${sortBy}`]: sortOrder } : { [sortBy]: sortOrder },
  };

  return {
    queryParams: queryParamsResult,
    metadata: { page, pageSize, sortBy, sortOrder },
  };
}