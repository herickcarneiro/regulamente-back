export interface BaseMapper<TRow, TEntity> {
  toDomain(row: TRow): TEntity;
  toRow(entity: TEntity): TRow;
}
