# FreeMarker snippets for NetSuite Advanced PDF templates

Small patterns that come up in almost every template job.

**Show a block only when the field has a value**

```
<#if record.memo?has_content>
    <p>${record.memo}</p>
</#if>
```

**Print the table header once, on the first line**

```
<#list record.item as item>
    <#if item_index == 0>
        <thead><tr><th>Item</th><th>Qty</th></tr></thead>
    </#if>
    <tr><td>${item.item}</td><td>${item.quantity}</td></tr>
</#list>
```

**Alternate row shading**

```
<#assign rowClass = (item_index % 2 == 1)?string("alt", "")>
<td class="${rowClass}">${item.item}</td>
```

**Do something between rows but not after the last one**

```
<#if item_has_next><hr /></#if>
```

**Page numbers**

```
Page <pagenumber/> of <totalpages/>
```

**Force a page break**

```
<pbr />
```

**Barcode from a field value**

```
<barcode codetype="code128" showtext="true" value="${record.tranid}" />
```

**Repeat header and footer on every page**

Define them as macros inside `<macrolist>` in the `<head>`, then reference them on the body:

```
<body header="nlheader" header-height="110pt" footer="nlfooter" footer-height="20pt">
```

If the header overlaps the page content, increase `header-height`.
