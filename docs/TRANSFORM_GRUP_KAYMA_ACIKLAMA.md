# Grup İçindeki Nesnenin Transform Sırasında Kayması – Açıklama

## Ne Oluyor?
Grup (group) içindeki bir layer’ı seçip taşıma/döndürme/resize yaparken nesne, transform uygulanmadan önce veya ilk harekette **bir miktar kayıyor** (sıçrama veya yer değiştirme hissediliyor).

## Olası Nedenler (Neden Yapamıyorsun Denmesinin Teknik Sebepleri)

### 1. İki farklı “konum” kaynağı
- **Görünen konum:** Layer’ın ekranda çizildiği yer (LayerPreview, `getInterpolatedLayerStyles` ile).
- **Seçim kutusu konumu:** Transform controller’ın çerçevesi `getSelectionBounds` ile hesaplanıyor (world koordinatları, bazen `x3d/y3d`, bazen projected 2D).
- Eğer bu ikisi **tam aynı formülle** hesaplanmıyorsa (ör. biri merkez, biri sol üst; biri interpolated, biri base), kutu ile layer görsel olarak çakışmaz. Sürüklerken “layer kutuya oturuyor” gibi hissedilir; bu da “kayma” gibi algılanır.

### 2. Snapshot vs canlı state
- Transform sırasında “başlangıç” için bir **snapshot** alınıyor (pointer down anında).
- Snapshot’taki world pozisyonlar `getSelectedWorldLayers` ile hesaplanıyor (o anki `stage.layers` + interpolasyon).
- Eğer snapshot alındığı anda kullanılan **selectionBounds** veya **world koordinatları**, LayerPreview’ın çizdiği konumdan bir piksel/farklı koordinat sisteminden dolayı farklıysa, ilk `onUpdate`’te delta “sıfır” olsa bile yazılan `x,y` aslında mevcut görünen konumla tam aynı olmayabilir. Bu da tek karelik bir “kayma” hissi verir.

### 3. İlk karede bile güncelleme yazılması
- Controller ilk mousemove’da `updates.x/y` gönderiyor. Biz de `applyTransformUpdate` ile `x,y` yazıyoruz.
- Delta gerçekten 0 olsa bile, **aynı değeri tekrar yazmak** (snapshot’taki local x,y’yi layer’a yazmak) bazen floating point veya başka bir yerde küçük farklara yol açabiliyor. Daha önemlisi: Eğer snapshot’taki konum, ekranda gördüğün konumdan (interpolasyon / farklı hesaplama yüzünden) zaten farklıysa, “sıfır delta” ile yazdığımız değer aslında görüntüyü hareket ettiriyor; yani **ilk karede kayma** oluyor.

### 4. Controller’ın aldığı `layer.x / layer.y`
- Controller’a verilen: `x: selectionBounds.x - selectionBounds.width/2`, `y: selectionBounds.y - selectionBounds.height/2` (yani seçim kutusunun **sol üst** köşesi, projected 2D).
- Bu değer `getSelectionBounds` çıktısına bağlı. Grup içi layer için bu bounds, world merkez + boyut + rotasyon ile hesaplanıyor. Eğer grup içi için bounds formülü (merkez, sol üst, perspektif) LayerPreview’daki çizimle **bire bir aynı değilse**, controller’ın “başlangıç” pozisyonu zaten kaymış olur; ilk hareket de buna göre yanlış delta üretir.

### 5. Özet: “Neden yapamıyorsun?”
- Tek bir “konum” yok; **üç ayrı yer** var:
  1. Layer’ın **store’daki** değeri (`layer.x`, `layer.y` – genelde parent’a göre local).
  2. **Görünen** konum (LayerPreview, interpolasyon + parent transform).
  3. **Seçim kutusu** konumu (getSelectionBounds + getSelectedWorldLayers).
- Kayma, bu üçünün aynı anda **tam tutarlı** olmamasından kaynaklanıyor. Özellikle grup içinde parent transform, scale ve bazen `x3d/y3d` vs projected 2D farkı devreye giriyor. Yani sorun “tek bir hata” değil; **koordinat sistemleri ve referans anları** tutarlı olmadığı için grup içi nesne kayıyor.

## Yapılan / Yapılacak Düzeltmeler

1. **Sıfır delta’da yazma:** Taşıma deltası gerçekten 0 ise (ve rotate/resize yoksa) `onBatchUpdateLayers` hiç çağrılmayacak; böylece “aynı değeri tekrar yazıp” gereksiz güncelleme yapılmayacak.
2. **İlk onUpdate’i atlama:** Mousedown sonrası gelen **ilk** onUpdate’te hiç layer güncellemesi uygulanmayacak; böylece ilk karede yanlış veya gereksiz bir yazma olmayacak.
3. **İleride (isteğe bağlı):** `getSelectionBounds` ve grup içi layer’ın çiziminin **aynı formülle** (aynı merkez/sol üst, aynı interpolasyon) hesaplandığından emin olmak; böylece kutu ile layer her zaman piksel seviyede çakışır.

Bu doküman, “neden yapamıyorsun” sorusunun teknik açıklaması ve alınan önlemlerin gerekçesidir.
