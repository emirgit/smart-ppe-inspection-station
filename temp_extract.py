import docx
import os

def extract_docx(file_path):
    doc = docx.Document(file_path)
    text = []
    for para in doc.paragraphs:
        if para.text.strip():
            text.append(para.text)
    
    out_path = file_path + ".txt"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(text))
    print(f"Extracted {len(text)} paragraphs to {out_path}")

extract_docx("d:/dev/GTU/396/smart-ppe-inspection-station/doc/CSE396_CENG_Module_Documentation_Group_11.docx")
extract_docx("d:/dev/GTU/396/smart-ppe-inspection-station/doc/CSE396_Module_Requirements_Group_11 (1).docx")
