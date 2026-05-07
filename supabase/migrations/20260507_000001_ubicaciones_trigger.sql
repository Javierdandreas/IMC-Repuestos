CREATE OR REPLACE FUNCTION trg_ubicaciones_codigo_auto()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sector_codigo IS NOT NULL 
     AND NEW.estanteria IS NOT NULL 
     AND NEW.nivel IS NOT NULL 
     AND NEW.posicion IS NOT NULL THEN
     
    NEW.codigo = NEW.sector_codigo || NEW.estanteria || '-' || NEW.nivel || '-' || NEW.posicion;
    NEW.codigo_barra = 'UBI:' || NEW.codigo;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ubicaciones_codigo_auto_trigger ON ubicaciones;
CREATE TRIGGER trg_ubicaciones_codigo_auto_trigger
BEFORE INSERT OR UPDATE OF sector_codigo, estanteria, nivel, posicion
ON ubicaciones
FOR EACH ROW
EXECUTE FUNCTION trg_ubicaciones_codigo_auto();
