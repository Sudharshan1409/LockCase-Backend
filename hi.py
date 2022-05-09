chars = """4<f^47}hJJ?ZjYoZm))!:F_9?;k\\$]#l/f%QqN|rye|ul{W(z?plP`M]?iU}]{#[nNnC?+Q|w91J"&S]e^mqZamaBF2DGRFa3k<p_.$#Ip*%-y\\tpf\\1Ee)^d0LbF+gbK7JS>YCi#71Yqsm6&>+yQ+m[Ouf*Gr0[mge;Vp(}y`0,9#CLLX3:lF&FLcovz9b7/0r.lZ}{TPB2;;5CLt/l<2gB:7i@&<%V,}!/[NF8c0hFweplL,1Su]sHzO`S0V7Px[g4oT^mo>JTr{Jh2aol9tHh(|[(),OBWs<nLi^U{+Kg"""

d = {}

for i in chars:
    if ord(i) >= 97 and ord(i) <= 122:
        s = chr(ord(i) - 32)
    else:
        s = i
    if s not in d:
        d[s] = 1
    else:
        d[s] += 1
print(d)