---
title: Raw HTML サポートを追加
published: 2024-12-06
tags:
- nextjs
categories:
- general
---

a

---

<figure>
  ![FUSE structure](https://upload.wikimedia.org/wikipedia/commons/0/08/FUSE_structure.svg)
  <figcaption>
    Copyright [Me](https://example.com), *as* <strong>foo</strong>
    <em>bar</em>
  </figcaption>
</figure>
<p>foo</p>
bar

baz

---

| a | b | c |
|---|---|---|
| d | e | f |

<table>
    <thead>
        <tr>
            <th>foo</th>
            <th>bar</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>baz</td>
            <td>bim</td>
        </tr>
    </tbody>
</table>
